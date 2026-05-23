import { useState, useRef, useEffect } from "react"
import axios from "axios"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@clerk/react"
import { Background } from "../components/Background"
import { Header } from "../components/Header"
import { Sidebar } from "../components/Sidebar"
import { MessageList } from "../components/MessageList"
import { InputBar } from "../components/InputBar"
import { useRecorder } from "../hooks/useRecorder"

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3009"

interface HistoryItem {
  q: string
  a: string
}
interface Chat {
  id: string
  title: string
  created_at: string
}
interface Document {
  source: string
  uploadedAt: number
}

const ChatPage = () => {
  const { isSignedIn, getToken } = useAuth()
  const signedIn = Boolean(isSignedIn)

  const { isRecording, isTranscribing, recError, startRecording, stopRecording } =
    useRecorder({
      onTranscript: (text) => setMessage(text),
      getToken,
    })

  const authHeaders = async () => {
    const token = await getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const [message, setMessage] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState("")
  const [response, setResponse] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [focused, setFocused] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [currentQ, setCurrentQ] = useState("")
  const [chatId, setChatId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedSource, setSelectedSource] = useState<string>("all")
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const [githubConnected, setGithubConnected] = useState(false)
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const [loadingGitHub, setLoadingGitHub] = useState(false)
  const [connectingGithub, setConnectingGithub] = useState(false)

  const currentResponseRef = useRef("")
  const streamRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [response, history, isStreaming])

  useEffect(() => {
    if (sidebarOpen && signedIn) void fetchChats()
  }, [sidebarOpen, signedIn])

  useEffect(() => {
    if (signedIn) void fetchDocuments()
  }, [signedIn])

  useEffect(() => {
    if (signedIn) void fetchGithubStatus()
  }, [signedIn])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("github") === "connected") {
      window.history.replaceState({}, "", window.location.pathname)
      void fetchGithubStatus()
    }
    if (params.get("github_error")) {
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const fetchChats = async () => {
    if (!signedIn) return
    setLoadingChats(true)
    try {
      const res = await axios.get(`${API}/history/chats`, {
        headers: await authHeaders(),
      })
      setChats(res.data.chats ?? [])
    } catch {
      setChats([])
    } finally {
      setLoadingChats(false)
    }
  }

  const fetchDocuments = async () => {
    if (!signedIn) return
    setLoadingDocs(true)
    try {
      const res = await axios.get(`${API}/documents/list`, {
        headers: await authHeaders(),
      })
      setDocuments(res.data.documents ?? [])
    } catch {
      setDocuments([])
    } finally {
      setLoadingDocs(false)
    }
  }

  const loadChat = async (selectedChatId: string) => {
    if (isStreaming) stopStreaming()
    setLoadingMessages(true)
    try {
      const res = await axios.get(`${API}/history/messages/${selectedChatId}`, {
        headers: await authHeaders(),
      })
      setHistory(
        (res.data.messages ?? []).map(
          (m: { query: string; answer: string }) => ({ q: m.query, a: m.answer })
        )
      )
      setChatId(selectedChatId)
      setFile(null)
      setFileName("")
      setMessage("")
      setSidebarOpen(false)
    } catch {
      /* ignore */
    } finally {
      setLoadingMessages(false)
    }
  }

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await axios.delete(`${API}/history/chats/${id}`, {
        headers: await authHeaders(),
      })
      setChats((prev) => prev.filter((c) => c.id !== id))
      if (chatId === id) handleNewChat()
    } catch {
      /* ignore */
    }
  }

  const handleDeleteSource = async (source: string) => {
    try {
      await axios.delete(`${API}/documents/delete`, {
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        data: { source },
      })
      setDocuments((prev) => prev.filter((d) => d.source !== source))
    } catch (err) {
      console.error("Delete source failed:", err)
      throw err
    }
  }

  const fetchGithubStatus = async () => {
    setLoadingGitHub(true)
    try {
      const res = await axios.get(`${API}/auth/github/status`, {
        headers: await authHeaders(),
      })
      setGithubConnected(res.data.connected ?? false)
      setGithubLogin(res.data.githubLogin ?? null)
    } catch {
      setGithubConnected(false)
    } finally {
      setLoadingGitHub(false)
    }
  }

  const handleIndexRepo = async (repoUrl: string) => {
    if (!signedIn || isIndexing) return
    setIsIndexing(true)

    try {
      const res = await axios.post(
        `${API}/github/index`,
        { repoUrl },
        { headers: await authHeaders() }
      )

      const { repoName, fileCount, chunkCount } = res.data

      await fetchDocuments()
      setSelectedSource(`github:${repoName}`)

      typewriterStream(
        `✅ Repository indexed successfully!\n\n` +
          `**${repoName}** is ready to explore.\n` +
          `— ${fileCount} files indexed\n` +
          `— ${chunkCount} chunks stored\n\n` +
          `You can now ask anything about this codebase.`,
        `Index ${repoName}`
      )
    } catch (err: unknown) {
      let errorMsg = "Failed to index repository. Please try again."

      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const bodyErr = err.response?.data?.error

        if (status === 404) {
          errorMsg =
            "Repository not found. Make sure it's public and the URL is correct."
        } else if (status === 429) {
          errorMsg = "GitHub API rate limit hit. Please wait an hour and try again."
        } else if (status === 422) {
          errorMsg = bodyErr ?? "No indexable files found in this repository."
        } else if (typeof bodyErr === "string" && bodyErr) {
          errorMsg = bodyErr
        }
      }

      typewriterStream(`⚠️ ${errorMsg}`, "Repo indexing failed")
    } finally {
      setIsIndexing(false)
    }
  }

  const stopStreaming = () => {
    if (streamRef.current) clearTimeout(streamRef.current)
    if (currentResponseRef.current && currentQ)
      setHistory((h) => [
        ...h,
        { q: currentQ, a: currentResponseRef.current + " [stopped]" },
      ])
    setIsStreaming(false)
    setResponse("")
    currentResponseRef.current = ""
    setCurrentQ("")
  }

  const typewriterStream = (text: string, question: string) => {
    setIsStreaming(true)
    setResponse("")
    currentResponseRef.current = ""
    setCurrentQ(question)
    let i = 0
    const type = () => {
      if (i < text.length) {
        const partial = text.slice(0, i + 1)
        setResponse(partial)
        currentResponseRef.current = partial
        const delay = text[i] === "\n" ? 18 : text[i] === "." ? 22 : 4
        i++
        streamRef.current = setTimeout(type, delay)
      } else {
        setIsStreaming(false)
        setHistory((h) => [...h, { q: question, a: text }])
        setResponse("")
        currentResponseRef.current = ""
        setCurrentQ("")
      }
    }
    type()
  }

  const handleNewChat = () => {
    if (isStreaming) stopStreaming()
    setChatId(null)
    setHistory([])
    setMessage("")
    setFile(null)
    setFileName("")
    setResponse("")
    currentResponseRef.current = ""
    setCurrentQ("")
    setSelectedSource("all")
    if (signedIn) setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleConnectGithub = async () => {
    if (connectingGithub) return
    setConnectingGithub(true)
    try {
      const res = await axios.get(`${API}/auth/github/start`, {
        headers: await authHeaders(),
      })
      if (res.data?.url) {
        window.location.href = res.data.url
        return
      }
      setConnectingGithub(false)
    } catch {
      console.error("Failed to start GitHub OAuth")
      setConnectingGithub(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!signedIn) return
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== "application/pdf") {
      alert("Only PDF files are allowed")
      return
    }
    setFile(f)
    setFileName(f.name)
  }

  const handleSend = async () => {
    if (!signedIn || !message.trim() || isStreaming) return
    const q = message.trim()
    const fd = new FormData()
    if (file) fd.append("File", file)
    fd.append("query", q)
    if (chatId) fd.append("chatId", chatId)
    if (selectedSource !== "all") fd.append("filterSource", selectedSource)

    setMessage("")
    setFile(null)
    setFileName("")
    setIsStreaming(true)

    try {
      const res = await axios.post(`${API}/query`, fd, {
        headers: await authHeaders(),
      })
      const text = res.data?.text ?? JSON.stringify(res.data)

      if (file) void fetchDocuments()

      if (res.data?.chatId && !chatId) {
        setChatId(res.data.chatId)
        if (sidebarOpen) void fetchChats()
      }
      typewriterStream(text, q)
    } catch (err: unknown) {
      let errorMsg = "Something went wrong. Please try again."
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const bodyErr = err.response?.data?.error
        if (status !== undefined && status >= 500) {
          errorMsg = "Something went wrong on our end. Please try again in a moment."
        } else if (
          typeof bodyErr === "string" &&
          bodyErr &&
          !/_KEY|SECRET|TOKEN|password|environment variable/i.test(bodyErr)
        ) {
          errorMsg = bodyErr
        }
      }
      setIsStreaming(false)
      typewriterStream(errorMsg, q)
    }
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Background />

      <Sidebar
        open={sidebarOpen}
        chats={chats}
        activeChatId={chatId}
        loading={loadingChats}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={loadChat}
        onDeleteChat={deleteChat}
      />

      <div className="relative z-[1] mx-auto flex h-full w-full max-w-[980px] flex-col px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 box-border sm:px-5 sm:pb-5 sm:pt-6 lg:px-7">
        <Header
          chatId={chatId}
          file={file}
          fileName={fileName}
          onRemoveFile={() => {
            setFile(null)
            setFileName("")
          }}
          onNewChat={handleNewChat}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <AnimatePresence>
          {loadingMessages && (
            <motion.div
              className="relative mb-1 h-0.5 shrink-0 overflow-hidden rounded-full bg-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-transparent via-accent to-transparent"
                animate={{ x: ["-100%", "250%"] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <MessageList
          history={history}
          isStreaming={isStreaming}
          response={response}
          currentQ={currentQ}
          scrollRef={scrollRef}
        />

        <InputBar
          message={message}
          file={file}
          fileName={fileName}
          isStreaming={isStreaming}
          focused={focused}
          signedIn={signedIn}
          inputRef={inputRef}
          documents={documents}
          selectedSource={selectedSource}
          loadingDocs={loadingDocs}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          recError={recError}
          isIndexing={isIndexing}
          onSourceChange={setSelectedSource}
          onChange={(val) => {
            setMessage(val)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSend={handleSend}
          onStop={stopStreaming}
          onFileChange={handleFileChange}
          onRemoveFile={() => {
            setFile(null)
            setFileName("")
          }}
          onRecordStart={startRecording}
          onRecordStop={stopRecording}
          onIndexRepo={handleIndexRepo}
          onDeleteSource={handleDeleteSource}
          githubConnected={githubConnected}
          githubLogin={githubLogin}
          loadingGitHub={loadingGitHub}
          connectingGithub={connectingGithub}
          onConnectGithub={handleConnectGithub}
        />
      </div>
    </div>
  )
}

export default ChatPage
