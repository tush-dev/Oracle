import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useClerk } from "@clerk/react"
import { getClerkAppearance } from "@/lib/clerk-appearance"
import { useTheme } from "@/context/theme"
import {
  ArrowUp,
  FileText,
  Filter,
  Loader2,
  Mic,
  Paperclip,
  Square,
  Trash2,
  X,
} from "lucide-react"
import { RepoInput } from "./RepoInput"
import { GithubIcon } from "./icons/GithubIcon"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip } from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/lib/utils"

interface Document {
  source: string
  uploadedAt: number
}

interface Props {
  message: string
  file: File | null
  fileName: string
  isStreaming: boolean
  focused: boolean
  signedIn: boolean
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  documents: Document[]
  selectedSource: string
  loadingDocs: boolean
  isRecording: boolean
  isTranscribing: boolean
  recError: string | null
  isIndexing: boolean
  onRecordStart: () => void
  onRecordStop: () => void
  onSourceChange: (val: string) => void
  onChange: (val: string) => void
  onFocus: () => void
  onBlur: () => void
  onSend: () => void
  onStop: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: () => void
  onIndexRepo: (url: string) => void
  onDeleteSource: (source: string) => Promise<void>
  githubConnected: boolean
  githubLogin: string | null
  loadingGitHub: boolean
  connectingGithub: boolean
  onConnectGithub: () => void
}

const toolbarBtn =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:h-9 sm:w-9"

function useAutoResizeTextarea(minHeight: number, maxHeight = 200) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current
      if (!textarea) return
      if (reset) {
        textarea.style.height = `${minHeight}px`
        return
      }
      textarea.style.height = `${minHeight}px`
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight)
      )
      textarea.style.height = `${newHeight}px`
    },
    [minHeight, maxHeight]
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) textarea.style.height = `${minHeight}px`
  }, [minHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [adjustHeight])

  return { textareaRef, adjustHeight }
}

function DeleteModal({
  source,
  onConfirm,
  onCancel,
  deleting,
}: {
  source: string
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  const isRepo = source.startsWith("github:")
  const label = isRepo ? source.replace("github:", "") : source
  const typeLabel = isRepo ? "repository" : "document"

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="glass-panel flex w-full max-w-sm flex-col items-center gap-3.5 rounded-2xl border border-border p-7"
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
          <Trash2 className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Delete {typeLabel}?</h3>
        <code className="max-w-full truncate rounded-lg border border-accent/25 bg-accent/10 px-3 py-1 font-mono text-[11px] text-accent">
          {label}
        </code>
        <p className="text-center text-sm leading-relaxed text-muted-foreground">
          All embeddings for this {typeLabel} will be permanently removed from Pinecone
          and Supabase. This cannot be undone.
        </p>
        <div className="flex w-full gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-lg border border-border py-2.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive/15 py-2.5 font-mono text-xs text-destructive transition-colors hover:bg-destructive/25 disabled:opacity-50"
          >
            {deleting ? (
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                Deleting…
              </motion.span>
            ) : (
              <>
                <Trash2 className="h-3 w-3" />
                Delete permanently
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function SourceChip({
  source,
  isActive,
  onSelect,
  onDelete,
  nudge,
}: {
  source: string
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  nudge?: boolean
}) {
  const isRepo = source.startsWith("github:")
  const label = isRepo
    ? source.replace("github:", "").slice(0, 22)
    : source.length > 22
      ? `${source.slice(0, 20)}…`
      : source

  return (
    <motion.div
      layout
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-md border text-[10px] font-mono transition-colors",
        isActive && "border-accent/40 bg-accent/10",
        nudge && !isActive && "border-accent/30 bg-accent/5",
        !isActive && !nudge && "border-border bg-transparent"
      )}
      animate={
        nudge && !isActive
          ? { boxShadow: ["0 0 0px transparent", "0 0 10px color-mix(in srgb, var(--accent) 35%, transparent)", "0 0 0px transparent"] }
          : {}
      }
      transition={nudge && !isActive ? { duration: 1.8, repeat: Infinity } : {}}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex max-w-[140px] items-center gap-1.5 truncate px-2 py-1 transition-colors",
          isActive ? "text-accent" : nudge ? "text-accent/70" : "text-muted-foreground"
        )}
      >
        {isRepo ? <GithubIcon className="h-2.5 w-2.5 opacity-80" /> : <FileText className="h-2.5 w-2.5 shrink-0 opacity-80" />}
        <span className="truncate">{label}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="flex w-5 items-center justify-center border-l border-border text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </motion.div>
  )
}

export const InputBar = ({
  message,
  file,
  fileName,
  isStreaming,
  focused,
  signedIn,
  inputRef,
  documents,
  selectedSource,
  loadingDocs,
  isRecording,
  isTranscribing,
  recError,
  isIndexing,
  onRecordStart,
  onRecordStop,
  onSourceChange,
  onChange,
  onFocus,
  onBlur,
  onSend,
  onStop,
  onFileChange,
  onRemoveFile,
  onIndexRepo,
  onDeleteSource,
  githubConnected,
  githubLogin,
  loadingGitHub,
  connectingGithub,
  onConnectGithub,
}: Props) => {
  const { openSignIn } = useClerk()
  const { theme } = useTheme()
  const isMobile = useIsMobile()
  const [showRepo, setShowRepo] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [nudge, setNudge] = useState(false)
  const [githubHint, setGithubHint] = useState<string | null>(null)
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const githubHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const githubAnchorRef = useRef<HTMLDivElement>(null)

  const { textareaRef, adjustHeight } = useAutoResizeTextarea(52, 160)

  useEffect(() => {
    if (inputRef && textareaRef.current) {
      ;(inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current =
        textareaRef.current
    }
  }, [inputRef, textareaRef])

  const hasDocs = documents.length > 0
  const isUnpinned = hasDocs && selectedSource === "all"

  useEffect(() => {
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
    if (isUnpinned && message.trim().length >= 10) {
      nudgeTimer.current = setTimeout(() => setNudge(true), 500)
    } else {
      setNudge(false)
    }
    return () => {
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
    }
  }, [isUnpinned, message])

  useEffect(() => {
    if (selectedSource !== "all") setNudge(false)
  }, [selectedSource])

  useEffect(() => {
    if (isIndexing) setShowRepo(false)
  }, [isIndexing])

  useEffect(() => {
    if (!showRepo) return
    const onDocClick = (e: MouseEvent) => {
      if (githubAnchorRef.current?.contains(e.target as Node)) return
      setShowRepo(false)
    }
    const t = window.setTimeout(() => document.addEventListener("click", onDocClick), 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener("click", onDocClick)
    }
  }, [showRepo])

  const flashGithubHint = (msg: string, ms = 4000) => {
    setGithubHint(msg)
    if (githubHintTimer.current) clearTimeout(githubHintTimer.current)
    githubHintTimer.current = setTimeout(() => setGithubHint(null), ms)
  }

  const promptSignIn = () => {
    void openSignIn({ appearance: getClerkAppearance(theme) })
  }

  const githubTooltip = (() => {
    if (!signedIn) return "Sign in to connect GitHub"
    if (loadingGitHub) return "Checking GitHub connection…"
    if (connectingGithub) return "Redirecting to GitHub…"
    if (isIndexing) return "Indexing in progress — wait to add another repo"
    if (!githubConnected) return "Connect GitHub to index public repositories"
    if (showRepo) return "Close repo indexer"
    return `Connected as ${githubLogin ?? "GitHub"} — tap to index a repository`
  })()

  const handleGithubClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!signedIn) {
      flashGithubHint("Sign in first to use GitHub")
      promptSignIn()
      return
    }
    if (loadingGitHub) {
      flashGithubHint("Checking GitHub status…")
      return
    }
    if (connectingGithub) {
      flashGithubHint("Opening GitHub authorization…")
      return
    }
    if (isIndexing) {
      flashGithubHint("Please wait until indexing finishes")
      return
    }
    if (!githubConnected) {
      flashGithubHint("Redirecting to GitHub to connect your account…")
      onConnectGithub()
      return
    }
    const next = !showRepo
    setShowRepo(next)
    flashGithubHint(
      next ? "Paste a public GitHub repo URL below" : "Repo indexer closed",
      3000
    )
    if (import.meta.env.DEV) {
      console.debug("[GitHub]", { signedIn, githubConnected, showRepo: next, githubLogin })
    }
  }

  const canChat = signedIn && !isStreaming && !isRecording && !isTranscribing
  const sendEnabled =
    signedIn && message.trim().length > 0 && !isStreaming && !isRecording && !isTranscribing

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await onDeleteSource(deleteTarget)
      if (selectedSource === deleteTarget) onSourceChange("all")
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const placeholder = (() => {
    if (isIndexing) return "Indexing repository…"
    if (isTranscribing) return "Transcribing voice…"
    if (isRecording) return "Recording — click stop to finish"
    if (!signedIn) return "Sign in to ask questions…"
    if (selectedSource !== "all")
      return `Ask about ${selectedSource.replace("github:", "").slice(0, 32)}…`
    return "Ask anything about your documents or repos…"
  })()

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (canChat && message.trim()) {
        onSend()
        adjustHeight(true)
      }
    }
  }

  const ringClass = isRecording
    ? "ring-2 ring-destructive/40"
    : isIndexing
      ? "ring-2 ring-indigo-400/40"
      : nudge
        ? "ring-2 ring-amber-400/35"
        : focused && signedIn
          ? "ring-2 ring-accent/40"
          : "ring-1 ring-border"

  return (
    <motion.div
      className="flex shrink-0 flex-col gap-2"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            source={deleteTarget}
            onConfirm={handleDeleteConfirm}
            onCancel={() => !deleting && setDeleteTarget(null)}
            deleting={deleting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recError && (
          <motion.div
            className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-1.5 font-mono text-[10px] text-destructive"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {recError}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {githubHint && (
          <motion.div
            className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 font-mono text-[10px] text-indigo-300"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {githubHint}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {signedIn && hasDocs && (
          <motion.div
            className="glass-panel flex min-h-[34px] items-center gap-2 rounded-xl border border-border/80 px-2.5 py-1.5 shadow-none"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
          >
            <div
              className={cn(
                "flex shrink-0 items-center gap-1 font-mono text-[9px] tracking-wider",
                nudge ? "text-amber-500" : selectedSource !== "all" ? "text-accent" : "text-muted-foreground/60"
              )}
            >
              <Filter className="h-2.5 w-2.5" />
              {nudge ? "pin a source →" : "filter"}
            </div>
            <div className="h-3.5 w-px shrink-0 bg-border" />
            <div className="scrollbar-thin flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => onSourceChange("all")}
                className={cn(
                  "shrink-0 rounded-md border px-2 py-0.5 font-mono text-[9px] transition-colors",
                  selectedSource === "all"
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:border-accent/30 hover:text-accent/70"
                )}
              >
                All
              </button>
              {documents.map((doc) => (
                <SourceChip
                  key={doc.source}
                  source={doc.source}
                  isActive={selectedSource === doc.source}
                  onSelect={() =>
                    onSourceChange(selectedSource === doc.source ? "all" : doc.source)
                  }
                  onDelete={() => setDeleteTarget(doc.source)}
                  nudge={nudge}
                />
              ))}
              {loadingDocs && (
                <span className="flex shrink-0 items-center gap-1 font-mono text-[9px] text-muted-foreground/50">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  loading…
                </span>
              )}
            </div>
            <AnimatePresence>
              {nudge && (
                <motion.span
                  className="flex shrink-0 items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] text-amber-600 dark:text-amber-400/80"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                >
                  may hallucinate
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "glass-panel relative overflow-visible rounded-2xl border transition-shadow",
          ringClass,
          !signedIn && "opacity-75"
        )}
      >
        <div className="overflow-y-auto">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              if (!signedIn) return
              onChange(e.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => signedIn && onFocus()}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={!signedIn || isTranscribing || isIndexing}
            rows={1}
            className={cn(
              "min-h-[52px] w-full resize-none border-0 bg-transparent px-4 py-3.5 text-sm text-foreground shadow-none",
              "placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0",
              !signedIn && "cursor-not-allowed"
            )}
            style={{ overflow: "hidden" }}
          />
        </div>

        <div className="flex items-center justify-between gap-1 border-t border-border/80 bg-white/25 px-2 py-2 dark:bg-white/[0.02] sm:gap-2 sm:px-3 sm:py-2.5">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <AnimatePresence mode="wait">
              {!file ? (
                <Tooltip content={signedIn ? "Attach PDF document" : "Sign in to attach PDF"} side="top">
                <motion.label
                  key="attach"
                  className={cn(
                    toolbarBtn,
                    "cursor-pointer border-border bg-card/70 text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-muted",
                    !signedIn && "pointer-events-none opacity-40"
                  )}
                  whileHover={signedIn ? { scale: 1.02 } : {}}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: signedIn ? 1 : 0.4 }}
                  exit={{ opacity: 0 }}
                >
                  <Paperclip className="h-4 w-4" />
                  {signedIn && (
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={onFileChange}
                    />
                  )}
                </motion.label>
                </Tooltip>
              ) : (
                <motion.div
                  key="chip"
                  className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-2 py-1.5"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <FileText className="h-3.5 w-3.5 text-success" />
                  <span className="max-w-[72px] truncate font-mono text-[10px] text-success">
                    {fileName.slice(0, 12)}
                    {fileName.length > 12 ? "…" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={signedIn ? onRemoveFile : undefined}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remove file"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={githubAnchorRef} className="relative">
              <Tooltip content={githubTooltip} side="top">
                <button
                  type="button"
                  aria-label={githubTooltip}
                  aria-expanded={showRepo}
                  onClick={handleGithubClick}
                  disabled={connectingGithub}
                  className={cn(
                    toolbarBtn,
                    "gap-1 px-2",
                    showRepo && githubConnected
                      ? "border-indigo-400/50 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400"
                      : githubConnected
                        ? "border-accent/30 bg-card/70 text-accent/80 hover:bg-white dark:hover:bg-muted"
                        : "border-border bg-card/70 text-muted-foreground hover:border-accent/40 hover:bg-white hover:text-accent dark:hover:bg-muted",
                    !signedIn && "cursor-not-allowed opacity-40",
                    connectingGithub && "opacity-70"
                  )}
                >
                  {loadingGitHub || connectingGithub ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GithubIcon className="h-4 w-4" />
                  )}
                  {githubConnected && githubLogin && !isMobile && (
                    <span className="hidden max-w-[72px] truncate text-[10px] font-mono lg:inline">
                      {githubLogin}
                    </span>
                  )}
                </button>
              </Tooltip>

              <AnimatePresence>
                {showRepo && githubConnected && (
                  <>
                    {isMobile && (
                      <motion.button
                        type="button"
                        aria-label="Close repo indexer"
                        className="fixed inset-0 z-[60] bg-black/50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowRepo(false)}
                      />
                    )}
                    <motion.div
                      className={cn(
                        "z-[70]",
                        isMobile
                          ? "fixed inset-x-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+5.5rem)]"
                          : "absolute bottom-full left-0 mb-2 w-[min(calc(100vw-1.5rem),380px)]"
                      )}
                      initial={{ opacity: 0, y: isMobile ? 12 : 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: isMobile ? 12 : 8 }}
                    >
                      <RepoInput
                        signedIn={signedIn}
                        isIndexing={isIndexing}
                        onIndex={(url) => {
                          onIndexRepo(url)
                          setShowRepo(false)
                        }}
                        onClose={() => setShowRepo(false)}
                      />
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <AnimatePresence mode="wait">
              {isTranscribing ? (
                <Tooltip content="Transcribing your voice…" side="top">
                  <div
                    key="transcribing"
                    className={cn(toolbarBtn, "border-border text-accent")}
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </Tooltip>
              ) : (
                <Tooltip
                  content={
                    !signedIn
                      ? "Sign in for voice input"
                      : isRecording
                        ? "Stop recording"
                        : "Voice input (mic)"
                  }
                  side="top"
                >
                  <motion.button
                    key="mic"
                    type="button"
                    onClick={!signedIn ? promptSignIn : isRecording ? onRecordStop : onRecordStart}
                    disabled={isTranscribing || isIndexing}
                    className={cn(
                      toolbarBtn,
                      isRecording
                        ? "border-destructive/50 bg-destructive/10 text-destructive"
                        : "border-border bg-card/70 text-muted-foreground hover:border-accent/40 hover:bg-white hover:text-foreground dark:hover:bg-muted",
                      (!signedIn || isIndexing) && "cursor-not-allowed opacity-40"
                    )}
                    whileTap={signedIn && !isIndexing ? { scale: 0.93 } : {}}
                  >
                    {isRecording ? (
                      <motion.span
                        className="h-2.5 w-2.5 rounded-sm bg-destructive"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 0.9 }}
                      />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </motion.button>
                </Tooltip>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {isStreaming ? (
                <Tooltip content="Stop generating" side="top">
                  <motion.button
                    key="stop"
                    type="button"
                    onClick={onStop}
                    className={cn(
                      toolbarBtn,
                      "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
                    )}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.93 }}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    aria-label="Stop generating"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </motion.button>
                </Tooltip>
              ) : (
                <Tooltip
                  content={sendEnabled ? "Send message" : "Type a message to send"}
                  side="top"
                >
                  <motion.button
                    key="send"
                    type="button"
                    onClick={onSend}
                    disabled={!sendEnabled}
                    className={cn(
                      toolbarBtn,
                      sendEnabled
                        ? "border-transparent bg-[linear-gradient(135deg,var(--accent),var(--brand-secondary))] text-accent-foreground shadow-[0_10px_24px_color-mix(in_srgb,var(--accent)_24%,transparent)] hover:opacity-95"
                        : "border-border bg-muted text-muted-foreground opacity-50"
                    )}
                    whileHover={sendEnabled ? { scale: 1.05 } : {}}
                    whileTap={sendEnabled ? { scale: 0.93 } : {}}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    aria-label="Send message"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </motion.button>
                </Tooltip>
              )}
            </AnimatePresence>
          </div>
        </div>

        {!signedIn && (
          <button
            type="button"
            aria-label="Sign in"
            onClick={promptSignIn}
            className="absolute inset-0 z-10 cursor-pointer rounded-2xl bg-transparent"
          />
        )}
      </div>

      <p className="hidden text-center font-mono text-[10px] text-muted-foreground/70 sm:block">
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[9px]">
          ↵
        </kbd>{" "}
        send ·{" "}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[9px]">
          ⇧↵
        </kbd>{" "}
        newline ·{" "}
        {selectedSource !== "all" ? (
          <span className="text-accent/70">
            filtering · {selectedSource.replace("github:", "").slice(0, 28)}
          </span>
        ) : (
          <span>PDF · Voice · GitHub</span>
        )}
      </p>
    </motion.div>
  )
}
