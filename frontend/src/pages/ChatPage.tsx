import { useState, useRef, useEffect } from "react"
import axios from "axios"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth, useClerk, useUser } from "@clerk/react"
import { LogOut, Moon, PanelLeft, Plus, Sun } from "lucide-react"
import { Background } from "../components/Background"
import { Header } from "../components/Header"
import { Sidebar } from "../components/Sidebar"
import { MessageList } from "../components/MessageList"
import { InputBar } from "../components/InputBar"
import { useRecorder } from "../hooks/useRecorder"
import { useIsMobile } from "../hooks/useIsMobile"
import { useTheme } from "../context/theme"

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3009"

const CHAT_QUERY_KEY = "chat"

const getUrlChatId = () => new URLSearchParams(window.location.search).get(CHAT_QUERY_KEY)

const replaceUrlParams = (params: URLSearchParams) => {
  const query = params.toString()
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
}

const setChatUrl = (nextChatId: string | null) => {
  const params = new URLSearchParams(window.location.search)
  if (nextChatId) {
    params.set(CHAT_QUERY_KEY, nextChatId)
  } else {
    params.delete(CHAT_QUERY_KEY)
  }
  replaceUrlParams(params)
}

const clearTransientUrlParams = () => {
  const params = new URLSearchParams(window.location.search)
  const hadTransientParams = params.has("github") || params.has("github_error")
  params.delete("github")
  params.delete("github_error")
  if (hadTransientParams) replaceUrlParams(params)
}

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
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { theme, toggleTheme } = useTheme()
  const signedIn = Boolean(isSignedIn)
  const isMobile = useIsMobile()

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
  const [chatId, setChatId] = useState<string | null>(() => getUrlChatId())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [workspaceSidebarOpen, setWorkspaceSidebarOpen] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [restoringChat, setRestoringChat] = useState(() => Boolean(getUrlChatId()))
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedSource, setSelectedSource] = useState<string>("all")
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const [githubConnected, setGithubConnected] = useState(false)
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const [loadingGitHub, setLoadingGitHub] = useState(false)
  const [connectingGithub, setConnectingGithub] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  const currentResponseRef = useRef("")
  const streamRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const workspaceActivatedRef = useRef(false)
  const restoredChatRef = useRef(false)

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [response, history, isStreaming])

  const chatStarted =
    restoringChat ||
    loadingMessages ||
    history.length > 0 ||
    Boolean(chatId) ||
    isStreaming ||
    Boolean(response) ||
    Boolean(currentQ)

  useEffect(() => {
    if ((sidebarOpen || workspaceSidebarOpen) && signedIn) void fetchChats()
  }, [sidebarOpen, workspaceSidebarOpen, signedIn])

  useEffect(() => {
    if (!chatStarted) return
    if (workspaceActivatedRef.current) return
    workspaceActivatedRef.current = true
    setWorkspaceSidebarOpen(false)
    if (signedIn) void fetchChats()
  }, [chatStarted, signedIn])

  useEffect(() => {
    if (!profileMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (profileMenuRef.current?.contains(event.target as Node)) return
      setProfileMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [profileMenuOpen])

  useEffect(() => {
    if (signedIn) void fetchDocuments()
  }, [signedIn])

  useEffect(() => {
    if (signedIn) void fetchGithubStatus()
  }, [signedIn])

  useEffect(() => {
    if (!authLoaded || signedIn || !restoringChat) return
    setRestoringChat(false)
  }, [authLoaded, signedIn, restoringChat])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("github") === "connected") {
      void fetchGithubStatus()
    }
    clearTransientUrlParams()
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

  const loadChat = async (
    selectedChatId: string,
    options: { closeSidebars?: boolean } = {}
  ) => {
    const { closeSidebars = true } = options
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
      setChatUrl(selectedChatId)
      setFile(null)
      setFileName("")
      setMessage("")
      if (closeSidebars) {
        setSidebarOpen(false)
        setWorkspaceSidebarOpen(false)
      }
      return true
    } catch {
      if (getUrlChatId() === selectedChatId) setChatUrl(null)
      setChatId(null)
      setHistory([])
      return false
    } finally {
      setLoadingMessages(false)
      setRestoringChat(false)
    }
  }

  useEffect(() => {
    if (!signedIn || restoredChatRef.current || history.length > 0) return

    const urlChatId = getUrlChatId()
    if (!urlChatId) return

    restoredChatRef.current = true
    setRestoringChat(true)
    void loadChat(urlChatId, { closeSidebars: false })
  }, [signedIn, chatId, history.length])

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await axios.delete(`${API}/history/chats/${id}`, {
        headers: await authHeaders(),
      })
      setChats((prev) => prev.filter((c) => c.id !== id))
      if (chatId === id) handleNewChat()
    } catch {
      void fetchChats()
    }
  }

  const renameChat = async (id: string, title: string) => {
    const cleanTitle = title.trim()
    if (!cleanTitle) return false

    const previousChats = chats
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id ? { ...chat, title: cleanTitle.slice(0, 80) } : chat
      )
    )

    try {
      const res = await axios.patch(
        `${API}/history/chats/${id}`,
        { title: cleanTitle },
        { headers: await authHeaders() }
      )
      if (res.data?.chat) {
        setChats((prev) =>
          prev.map((chat) => (chat.id === id ? res.data.chat : chat))
        )
      }
      return true
    } catch {
      setChats(previousChats)
      return false
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
    setChatUrl(null)
    setRestoringChat(false)
    workspaceActivatedRef.current = false
    setWorkspaceSidebarOpen(false)
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
        setChatUrl(res.data.chatId)
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

  const profileInitial =
    user?.firstName?.[0] ??
    user?.username?.[0] ??
    user?.primaryEmailAddress?.emailAddress?.[0] ??
    "U"

  return (
    <div className="relative flex h-[100dvh] min-h-[560px] w-screen overflow-hidden bg-background text-foreground">
      <Background />

      {!chatStarted && (
        <Sidebar
          open={sidebarOpen}
          chats={chats}
          activeChatId={chatId}
          loading={loadingChats}
          onClose={() => setSidebarOpen(false)}
          onNewChat={handleNewChat}
          onSelectChat={loadChat}
          onDeleteChat={deleteChat}
          onRenameChat={renameChat}
        />
      )}

      {chatStarted && isMobile && (
        <Sidebar
          open={workspaceSidebarOpen}
          chats={chats}
          activeChatId={chatId}
          loading={loadingChats}
          onClose={() => setWorkspaceSidebarOpen(false)}
          onNewChat={handleNewChat}
          onSelectChat={loadChat}
          onDeleteChat={deleteChat}
          onRenameChat={renameChat}
        />
      )}

      <div className="relative z-[1] flex h-full w-full">
        {chatStarted && !isMobile && (
          <Sidebar
            open={workspaceSidebarOpen}
            mode="docked"
            chats={chats}
            activeChatId={chatId}
            loading={loadingChats}
            onClose={() => setWorkspaceSidebarOpen(false)}
            onNewChat={handleNewChat}
            onSelectChat={loadChat}
            onDeleteChat={deleteChat}
            onRenameChat={renameChat}
          />
        )}

        <main
          className={
            chatStarted
              ? "mx-auto box-border flex h-full min-w-0 flex-1 flex-col px-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-4 sm:pb-3 sm:pt-3 lg:px-5 lg:pb-4 lg:pt-4"
              : "mx-auto box-border flex h-full w-full max-w-[1080px] flex-col px-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-4 sm:pb-4 sm:pt-4 lg:px-6 lg:pb-5 lg:pt-5"
          }
        >
        {!chatStarted ? (
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
        ) : (
          <div className="mb-1.5 flex h-11 shrink-0 items-center justify-between border-b border-border/70 px-0.5 sm:mb-2 sm:h-12 sm:px-1.5 lg:mb-3 lg:h-14 lg:px-2">
            <div className="flex min-w-0 items-center gap-2">
              {(!workspaceSidebarOpen || isMobile) && (
                <button
                  type="button"
                  onClick={() => setWorkspaceSidebarOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/70 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground sm:h-9 sm:w-9"
                  aria-label="Show all chats"
                  title="Show all chats"
                >
                  <PanelLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              )}
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-foreground sm:text-sm">
                  Oracle Chat
                </div>
                <div className="font-mono text-[8px] tracking-[0.16em] text-muted-foreground sm:text-[9px] sm:tracking-[0.18em]">
                  {chatId ? `#${chatId.slice(0, 8)}` : "ACTIVE SESSION"}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleNewChat}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/70 text-muted-foreground shadow-sm transition-colors hover:border-accent/40 hover:bg-muted hover:text-accent sm:h-9 sm:w-9"
                aria-label="New chat"
                title="New chat"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-card/80 text-xs font-semibold text-accent shadow-sm transition-colors hover:border-accent/40 hover:bg-muted sm:h-9 sm:w-9 sm:text-sm"
                  aria-label="Open profile menu"
                  aria-expanded={profileMenuOpen}
                  title="Profile"
                >
                  {user?.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{profileInitial.toUpperCase()}</span>
                  )}
                </button>

                <AnimatePresence>
                  {profileMenuOpen && (
                    <motion.div
                      className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-float)]"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                    >
                      <div className="border-b border-border px-3.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-accent">
                            {user?.imageUrl ? (
                              <img
                                src={user.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              profileInitial.toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {user?.fullName ?? user?.username ?? "Profile"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          toggleTheme()
                          setProfileMenuOpen(false)
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      >
                        <span className="flex items-center gap-2.5">
                          {theme === "dark" ? (
                            <Sun className="h-4 w-4 text-accent" />
                          ) : (
                            <Moon className="h-4 w-4 text-accent" />
                          )}
                          {theme === "dark" ? "Light mode" : "Dark mode"}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          {theme}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void signOut({ redirectUrl: "/" })}
                        className="flex w-full items-center gap-2.5 border-t border-border px-3.5 py-3 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

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
        </main>
      </div>
    </div>
  )
}

export default ChatPage
