import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useClerk } from "@clerk/react"
import { RepoInput } from "./RepoInput"

interface Document {
  source:     string
  uploadedAt: number
}

interface Props {
  message:        string
  file:           File | null
  fileName:       string
  charCount:      number
  chatId:         string | null
  isStreaming:    boolean
  focused:        boolean
  signedIn:       boolean
  inputRef:       React.RefObject<HTMLInputElement | null>
  documents:      Document[]
  selectedSource: string
  loadingDocs:    boolean
  isRecording:    boolean
  isTranscribing: boolean
  recError:       string | null
  isIndexing:     boolean
  onRecordStart:  () => void
  onRecordStop:   () => void
  onSourceChange: (val: string) => void
  onChange:       (val: string) => void
  onFocus:        () => void
  onBlur:         () => void
  onSend:         () => void
  onStop:         () => void
  onFileChange:   (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile:   () => void
  onIndexRepo:    (url: string) => void
  onDeleteSource: (source: string) => Promise<void>
  historyLength:  number
  githubConnected : boolean           
  githubLogin     : string | null     
  loadingGitHub   : boolean           
  onConnectGithub : () => void   
}

// ── Delete confirmation modal ──────────────────────────────────────────────
const DeleteModal = ({
  source, onConfirm, onCancel, deleting,
}: {
  source: string; onConfirm: () => void; onCancel: () => void; deleting: boolean
}) => {
  const isRepo    = source.startsWith("github:")
  const label     = isRepo ? source.replace("github:", "") : source
  const typeLabel = isRepo ? "repository" : "document"

  return (
    <motion.div style={s.modalOverlay}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div style={s.modal}
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={s.modalIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div style={s.modalTitle}>Delete {typeLabel}?</div>
        <div style={s.modalSource}>{label}</div>
        <div style={s.modalWarning}>
          All embeddings for this {typeLabel} will be permanently removed
          from Pinecone and Supabase. This cannot be undone.
        </div>
        <div style={s.modalActions}>
          <motion.button type="button" onClick={onCancel} style={s.modalCancel}
            whileHover={{ borderColor: "#3a3a50" }} whileTap={{ scale: 0.96 }} disabled={deleting}>
            Cancel
          </motion.button>
          <motion.button type="button" onClick={onConfirm}
            style={{ ...s.modalDelete, ...(deleting ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}
            whileHover={!deleting ? { background: "#ef444433" } : {}}
            whileTap={!deleting ? { scale: 0.96 } : {}} disabled={deleting}>
            {deleting ? (
              <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                Deleting…
              </motion.span>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
                Delete permanently
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────────
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div style={s.tooltip}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.15 }}>
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Source chip ────────────────────────────────────────────────────────────
const SourceChip = ({
  source, isActive, onSelect, onDelete, nudge,
}: {
  source: string; isActive: boolean; onSelect: () => void
  onDelete: () => void; nudge?: boolean
}) => {
  const isRepo = source.startsWith("github:")
  const label  = isRepo
    ? source.replace("github:", "").slice(0, 22)
    : source.length > 22 ? source.slice(0, 20) + "…" : source

  return (
    <motion.div layout
      style={{
        ...s.sourceChip,
        ...(isActive ? s.sourceChipActive : {}),
        ...(nudge && !isActive ? s.sourceChipNudge : {}),
      }}
      animate={nudge && !isActive ? {
        boxShadow: ["0 0 0px #c9a84c00", "0 0 10px #c9a84c55", "0 0 0px #c9a84c00"],
      } : {}}
      transition={nudge && !isActive ? { duration: 1.8, repeat: Infinity } : {}}
    >
      <button type="button" onClick={onSelect} style={{
        ...s.chipSelectBtn,
        color: isActive ? "#c9a84c" : nudge ? "#c9a84caa" : "#5a5a72",
      }}>
        {isRepo ? (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, opacity: 0.8 }}>
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        ) : (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.8 }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        )}
        <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {label}
        </span>
      </button>
      <motion.button type="button"
        onClick={e => { e.stopPropagation(); onDelete() }}
        style={s.chipDeleteBtn}
        whileHover={{ color: "#f87171", background: "#f871710d" }}
        whileTap={{ scale: 0.85 }}
      >
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </motion.button>
    </motion.div>
  )
}

// ── Source selector row ────────────────────────────────────────────────────
const SourceSelector = ({
  documents, selectedSource, loadingDocs, nudge, onSourceChange, onDelete,
}: {
  documents: Document[]; selectedSource: string; loadingDocs: boolean
  nudge: boolean; onSourceChange: (v: string) => void; onDelete: (s: string) => void
}) => (
  <motion.div style={s.sourceRow}
    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.2 }}
  >
    {/* Label */}
    <div style={s.sourceRowLabel}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
        stroke={nudge ? "#f59e0b" : selectedSource !== "all" ? "#c9a84c" : "#3a3a50"}
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: "stroke 0.3s", flexShrink: 0 }}>
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
      <span style={{ color: nudge ? "#f59e0b88" : "#2e2e40", transition: "color 0.3s" }}>
        {nudge ? "pin a source →" : "filter"}
      </span>
    </div>

    <div style={s.sourceRowDivider}/>

    {/* Chips */}
    <div style={s.sourceChipsScroll}>
      <motion.button type="button"
        onClick={() => onSourceChange("all")}
        style={{ ...s.allChip, ...(selectedSource === "all" ? s.allChipActive : {}) }}
        whileHover={{ borderColor: "#c9a84c44", color: "#c9a84c88" }}
        whileTap={{ scale: 0.93 }}
      >
        All
      </motion.button>

      {documents.map(doc => (
        <SourceChip
          key={doc.source}
          source={doc.source}
          isActive={selectedSource === doc.source}
          onSelect={() => onSourceChange(selectedSource === doc.source ? "all" : doc.source)}
          onDelete={() => onDelete(doc.source)}
          nudge={nudge}
        />
      ))}

      {loadingDocs && <span style={s.loadingChip}>loading…</span>}
    </div>

    {/* Hallucination badge */}
    <AnimatePresence>
      {nudge && (
        <motion.div style={s.hallucinationBadge}
          initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          may hallucinate
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
)

// ── Main InputBar ──────────────────────────────────────────────────────────
export const InputBar = ({
  message, file, fileName, charCount, chatId, isStreaming,
  focused, signedIn, inputRef, documents, selectedSource, loadingDocs,
  isRecording, isTranscribing, recError, isIndexing,
  onRecordStart, onRecordStop, onSourceChange, onChange,
  onFocus, onBlur, onSend, onStop, onFileChange, onRemoveFile,
  onIndexRepo, onDeleteSource, historyLength, githubConnected,
  githubLogin,loadingGitHub,onConnectGithub}: Props) => {
  const { openSignIn }                  = useClerk()
  const [showRepo,     setShowRepo]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [nudge,        setNudge]        = useState(false)
  const nudgeTimer                      = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasDocs    = documents.length > 0
  const isUnpinned = hasDocs && selectedSource === "all"

  useEffect(() => {
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
    if (isUnpinned && message.trim().length >= 10) {
      nudgeTimer.current = setTimeout(() => setNudge(true), 500)
    } else {
      setNudge(false)
    }
    return () => { if (nudgeTimer.current) clearTimeout(nudgeTimer.current) }
  }, [isUnpinned, message])

  useEffect(() => { if (selectedSource !== "all") setNudge(false) }, [selectedSource])

  const canChat      = signedIn && !isStreaming && !isRecording && !isTranscribing
  const sendEnabled  = signedIn && message.trim().length > 0 && !isStreaming && !isRecording && !isTranscribing
  const promptSignIn = () => { void openSignIn() }

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
    if (isIndexing)     return "Indexing repository…"
    if (isTranscribing) return "Transcribing voice…"
    if (isRecording)    return "Recording — click ■ to stop"
    if (!signedIn)      return "Sign in to ask questions…"
    if (selectedSource !== "all")
      return `Ask about ${selectedSource.replace("github:", "").slice(0, 32)}…`
    return "Ask anything…"
  })()

  return (
    <motion.div style={s.root}
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Delete modal */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal source={deleteTarget} onConfirm={handleDeleteConfirm}
            onCancel={() => !deleting && setDeleteTarget(null)} deleting={deleting}/>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div style={s.statsRow}>
        <span style={s.stat}><span style={{ color: "#c9a84c" }}>{historyLength}</span> exchanges</span>
        <span style={s.statDot}/>
        <span style={s.stat}>
          <span style={{ color: file ? "#4ade80" : "#3a3a48" }}>
            {file ? `📎 ${fileName.slice(0, 16)}${fileName.length > 16 ? "…" : ""}` : "No document"}
          </span>
        </span>
        <span style={s.statDot}/>
        <span style={s.stat}>
          <span style={{ color: charCount > 200 ? "#f87171" : "#3a3a48" }}>{charCount} chars</span>
        </span>
        <span style={s.statDot}/>
        <span style={s.stat}>
          <span style={{ color: chatId ? "#c9a84c" : "#3a3a48" }}>{chatId ? "Chat active" : "New session"}</span>
        </span>
        <AnimatePresence>
          {(isRecording || isTranscribing) && (
            <motion.span style={s.recBadge}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <motion.span style={{ ...s.recDot, background: isTranscribing ? "#c9a84c" : "#f87171" }}
                animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}/>
              {isRecording ? "recording…" : "transcribing…"}
            </motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isIndexing && (
            <motion.span style={s.indexingBadge}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <motion.span style={{ ...s.recDot, background: "#818cf8" }}
                animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}/>
              indexing…
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      <AnimatePresence>
        {recError && (
          <motion.div style={s.errBanner}
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            ⚠ {recError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Repo panel */}
      <AnimatePresence>
        {showRepo && githubConnected && (
          <RepoInput signedIn={signedIn} isIndexing={isIndexing}
            onIndex={url => { onIndexRepo(url) }} onClose={() => setShowRepo(false)}/>
        )}
      </AnimatePresence>

      {/* ── SOURCE ROW — separate clean row above the input ── */}
      <AnimatePresence>
        {signedIn && hasDocs && (
          <SourceSelector
            documents={documents} selectedSource={selectedSource}
            loadingDocs={loadingDocs} nudge={nudge}
            onSourceChange={onSourceChange} onDelete={src => setDeleteTarget(src)}
          />
        )}
      </AnimatePresence>

      {/* ── MAIN INPUT BAR — clean, uncluttered ── */}
      <motion.div style={{
        ...s.inputWrap, position: "relative",
        opacity: signedIn ? 1 : 0.72,
        boxShadow: isRecording
          ? "0 0 0 1.5px #f8717155, 0 8px 40px #f8717110"
          : isIndexing
          ? "0 0 0 1.5px #818cf855, 0 8px 40px #818cf810"
          : nudge
          ? "0 0 0 1.5px #f59e0b44, 0 8px 40px #f59e0b0c"
          : focused && signedIn
          ? "0 0 0 1.5px #c9a84c55, 0 8px 40px #c9a84c10"
          : "0 0 0 1px #1e1e2c, 0 4px 24px #00000060",
      }} transition={{ duration: 0.25 }}>

        {/* Left: PDF + Repo */}
        <div style={s.leftCluster}>
          <AnimatePresence mode="wait">
            {!file ? (
              <Tooltip text="Upload a PDF">
                <motion.label key="attach" style={{
                  ...s.iconBtn,
                  pointerEvents: signedIn ? "auto" : "none",
                  opacity: signedIn ? 1 : 0.4,
                  cursor: signedIn ? "pointer" : "not-allowed",
                }}
                  whileHover={signedIn ? { borderColor: "#c9a84c77", color: "#c9a84c", background: "#c9a84c09" } : {}}
                  initial={{ opacity: 0 }} animate={{ opacity: signedIn ? 1 : 0.4 }} exit={{ opacity: 0 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                  </svg>
                  {signedIn && <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={onFileChange}/>}
                </motion.label>
              </Tooltip>
            ) : (
              <motion.div key="chip" style={s.fileChip}
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span style={s.chipName}>{fileName.slice(0, 10)}{fileName.length > 10 ? "…" : ""}</span>
                <button type="button" onClick={signedIn ? onRemoveFile : undefined}
                  style={{ ...s.chipX, cursor: signedIn ? "pointer" : "not-allowed" }}>✕</button>
              </motion.div>
            )}
          </AnimatePresence>


          <div style={s.vSep}/>

          <Tooltip text={
  loadingGitHub
    ? "Checking GitHub…"
    : githubConnected
    ? `Connected as ${githubLogin ?? "GitHub"} — Index a repo`
    : "Connect GitHub to index repos"
}>
  <motion.button
    type="button"
    onClick={
      !signedIn
        ? promptSignIn
        : !githubConnected
        ? onConnectGithub
        : () => setShowRepo(v => !v)
    }
    style={{
      ...s.iconBtn,
      ...(showRepo ? {
        borderColor : "#818cf855",
        color       : "#818cf8",
        background  : "#818cf80a",
      } : {}),
      ...(githubConnected && !showRepo ? {
        borderColor : "#c9a84c33",
        color       : "#c9a84c88",
      } : {}),
      ...(!githubConnected ? {
        borderColor : "#1a1a28",
        color       : "#2a2a3a",
      } : {}),
      opacity : signedIn ? 1 : 0.4,
      cursor  : signedIn ? "pointer" : "not-allowed",
    }}
    whileHover={signedIn ? {
      borderColor : githubConnected ? "#818cf866" : "#c9a84c44",
      color       : githubConnected ? "#818cf8"   : "#c9a84c",
    } : {}}
    whileTap={signedIn ? { scale: 0.93 } : {}}
  >
    {loadingGitHub ? (
      <motion.span
        style={{
          display      : "block",
          width        : "7px",
          height       : "7px",
          borderRadius : "50%",
          background   : "#3a3a50",
        }}
        animate={{ opacity: [1, 0.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
      />
    ) : (
      <svg
        width="13" height="13" viewBox="0 0 24 24"
        fill={githubConnected ? "currentColor" : "#2a2a3a"}
      >
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    )}
  </motion.button>
</Tooltip>
        </div>

        <div style={s.vSep}/>

        {/* Text input */}
        <input
          ref={inputRef}
          style={{ ...s.input, cursor: signedIn ? "text" : "not-allowed" }}
          type="text"
          placeholder={placeholder}
          value={message}
          disabled={!signedIn || isTranscribing || isIndexing}
          onChange={e => signedIn && onChange(e.target.value)}
          onFocus={() => signedIn && onFocus()}
          onBlur={onBlur}
          onKeyDown={e => e.key === "Enter" && canChat && onSend()}
        />

        {/* Right: Mic + Send */}
        <div style={s.rightCluster}>
          <AnimatePresence mode="wait">
            {isTranscribing ? (
              <motion.div key="transcribing" style={s.transcribingDot}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.span style={{ ...s.recDot, background: "#c9a84c", width: 8, height: 8 }}
                  animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 0.7 }}/>
              </motion.div>
            ) : (
              <Tooltip text={isRecording ? "Stop recording" : "Voice input"}>
                <motion.button key="mic" type="button"
                  onClick={!signedIn ? promptSignIn : isRecording ? onRecordStop : onRecordStart}
                  disabled={isTranscribing}
                  style={{
                    ...s.iconBtn,
                    ...(isRecording ? { borderColor: "#f8717155", background: "#f871710a", color: "#f87171" } : {}),
                    opacity: signedIn ? 1 : 0.4,
                    cursor: signedIn ? "pointer" : "not-allowed",
                  }}
                  whileHover={signedIn && !isTranscribing ? { borderColor: isRecording ? "#f8717199" : "#c9a84c77", scale: 1.06 } : {}}
                  whileTap={signedIn ? { scale: 0.91 } : {}}
                >
                  {isRecording ? (
                    <motion.span style={s.stopSqRed}
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}/>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                  )}
                </motion.button>
              </Tooltip>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {isStreaming ? (
              <motion.button key="stop" type="button" onClick={onStop} style={s.stopBtn}
                whileHover={{ scale: 1.07, background: "#c9a84c1a" }} whileTap={{ scale: 0.91 }}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                <span style={s.stopSq}/>
              </motion.button>
            ) : (
              <motion.button key="send" type="button" onClick={onSend} disabled={!sendEnabled}
                style={{ ...s.sendBtn, ...(!sendEnabled ? s.sendOff : {}) }}
                whileHover={sendEnabled ? { scale: 1.06 } : {}} whileTap={sendEnabled ? { scale: 0.91 } : {}}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {!signedIn && (
          <button type="button" aria-label="Sign in" onClick={promptSignIn} style={s.signInGate}/>
        )}
      </motion.div>

      {/* Footer */}
      <div style={s.footer}>
        <span style={s.footerText}>
          <kbd style={s.kbd}>↵</kbd> send &nbsp;·&nbsp;
          <kbd style={s.kbd}>🎙</kbd> voice &nbsp;·&nbsp;
          {selectedSource !== "all"
            ? <span style={{ color: "#c9a84c77" }}>filtering · {selectedSource.replace("github:", "").slice(0, 28)}</span>
            : <span>RAG · Voyage · Groq</span>
          }
        </span>
      </div>
    </motion.div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:          { flexShrink: 0, display: "flex", flexDirection: "column", gap: "6px" },

  statsRow:      { display: "flex", alignItems: "center", gap: "8px", padding: "0 4px", flexWrap: "wrap" },
  stat:          { fontSize: "10px", color: "#3a3a48", letterSpacing: "0.05em", fontFamily: "'DM Mono',monospace" },
  statDot:       { width: "3px", height: "3px", borderRadius: "50%", background: "#2a2a38", flexShrink: 0 },
  recBadge:      { display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", color: "#f87171", fontFamily: "'DM Mono',monospace", marginLeft: "auto" },
  indexingBadge: { display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", color: "#818cf8", fontFamily: "'DM Mono',monospace" },
  recDot:        { display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#f87171", flexShrink: 0 },
  errBanner:     { fontSize: "10px", color: "#f87171", background: "#f871710d", border: "1px solid #f8717122", borderRadius: "8px", padding: "5px 10px", fontFamily: "'DM Mono',monospace" },

  // Source row — its own separate bar above the input
  sourceRow: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "5px 10px", borderRadius: "10px",
    border: "1px solid #181826", background: "#09090f",
    minHeight: "34px",
  },
  sourceRowLabel: {
    display: "flex", alignItems: "center", gap: "5px", flexShrink: 0,
    fontSize: "9px", color: "#2e2e40",
    fontFamily: "'DM Mono',monospace", letterSpacing: "0.07em",
  },
  sourceRowDivider: { width: "1px", height: "14px", background: "#181826", flexShrink: 0 },
  sourceChipsScroll: {
    display: "flex", alignItems: "center", gap: "4px",
    flex: 1, minWidth: 0,
    overflowX: "auto", overflowY: "hidden",
    scrollbarWidth: "none", padding: "1px 0",
  },
  allChip: {
    display: "flex", alignItems: "center",
    padding: "2px 9px", borderRadius: "5px",
    border: "1px solid #181826", background: "transparent",
    color: "#2e2e40", fontSize: "9px", fontFamily: "'DM Mono',monospace",
    cursor: "pointer", letterSpacing: "0.05em", flexShrink: 0,
    transition: "all 0.15s", whiteSpace: "nowrap" as const,
  },
  allChipActive:    { borderColor: "#c9a84c44", background: "#c9a84c0c", color: "#c9a84c" },
  loadingChip:      { fontSize: "9px", color: "#2a2a38", fontFamily: "'DM Mono',monospace", flexShrink: 0 },
  sourceChip: {
    display: "inline-flex", alignItems: "stretch",
    borderRadius: "6px", border: "1px solid #181826",
    background: "transparent", flexShrink: 0,
    transition: "border-color 0.15s", overflow: "hidden",
  },
  sourceChipActive: { borderColor: "#c9a84c44", background: "#c9a84c08" },
  sourceChipNudge:  { borderColor: "#c9a84c33", background: "#c9a84c05" },
  chipSelectBtn: {
    display: "flex", alignItems: "center", gap: "5px",
    padding: "2px 6px 2px 8px",
    fontSize: "9px", fontFamily: "'DM Mono',monospace",
    cursor: "pointer", background: "transparent", border: "none",
    letterSpacing: "0.03em", whiteSpace: "nowrap" as const, transition: "color 0.15s",
  },
  chipDeleteBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "18px", color: "#252535", cursor: "pointer",
    background: "transparent", border: "none",
    borderLeft: "1px solid #141420",
    transition: "all 0.15s", flexShrink: 0,
  },
  hallucinationBadge: {
    display: "flex", alignItems: "center", gap: "5px", flexShrink: 0,
    padding: "2px 8px", borderRadius: "5px",
    border: "1px solid #f59e0b1a", background: "#f59e0b06",
    fontSize: "9px", color: "#f59e0b77",
    fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em", whiteSpace: "nowrap" as const,
  },

  // Main input bar
  inputWrap: {
    display: "flex", alignItems: "center",
    borderRadius: "14px", border: "1px solid #1a1a28",
    background: "#0c0c12", minHeight: "52px",
    transition: "box-shadow 0.25s", overflow: "hidden",
  },
  signInGate: { position: "absolute", inset: 0, zIndex: 10, cursor: "pointer", border: "none", padding: 0, background: "transparent", borderRadius: "14px" },

  leftCluster:  { display: "flex", alignItems: "center", padding: "0 6px 0 10px", gap: "0", flexShrink: 0 },
  rightCluster: { display: "flex", alignItems: "center", gap: "6px", padding: "0 10px 0 6px", flexShrink: 0 },

  iconBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "32px", height: "32px", borderRadius: "9px",
    border: "1px solid #1a1a28", background: "transparent",
    color: "#404058", cursor: "pointer", flexShrink: 0,
    transition: "all 0.18s",
  },

  fileChip: {
    display: "flex", alignItems: "center", gap: "5px",
    padding: "4px 8px", borderRadius: "9px",
    border: "1px solid #4ade8020", background: "#4ade800a", flexShrink: 0,
  },
  chipName: { fontSize: "9px", color: "#4ade80", maxWidth: "70px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  chipX:    { background: "none", border: "none", color: "#3a4a3a", fontSize: "10px", padding: "0 2px", lineHeight: 1 },

  vSep: { width: "1px", height: "20px", background: "#16162a", flexShrink: 0, margin: "0 6px" },

  input: {
    flex: 1, background: "transparent", border: "none", outline: "none",
    color: "#e0e0ec", fontSize: "13px",
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
    letterSpacing: "0.01em", lineHeight: "1.5",
    padding: "0 4px", minWidth: "80px",
  },

  stopSqRed:        { display: "block", width: "9px", height: "9px", borderRadius: "2px", background: "#f87171" },
  transcribingDot:  { display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px" },

  sendBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "36px", height: "36px", borderRadius: "10px", border: "none",
    background: "linear-gradient(135deg, #c9a84c 0%, #9a7228 100%)",
    color: "#08080a", cursor: "pointer", flexShrink: 0,
    boxShadow: "0 2px 12px #c9a84c33",
  },
  sendOff: { opacity: 0.2, cursor: "not-allowed", boxShadow: "none" },
  stopBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "36px", height: "36px", borderRadius: "10px",
    border: "1px solid #c9a84c33", background: "#c9a84c08",
    cursor: "pointer", flexShrink: 0, transition: "background 0.2s",
  },
  stopSq: { display: "block", width: "11px", height: "11px", borderRadius: "3px", background: "#c9a84c" },

  footer:     { display: "flex", justifyContent: "center", paddingTop: "2px" },
  footerText: { fontSize: "10px", color: "#22223a", letterSpacing: "0.05em", fontFamily: "'DM Mono',monospace" },
  kbd:        { padding: "1px 5px", borderRadius: "4px", border: "1px solid #1a1a28", background: "#090910", color: "#32324a", fontSize: "9px" },

  tooltip: {
    position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
    transform: "translateX(-50%)",
    background: "#12121c", border: "1px solid #242438", borderRadius: "8px",
    padding: "5px 10px", fontSize: "10px", color: "#8a8aa8",
    fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" as const,
    zIndex: 100, letterSpacing: "0.03em",
    pointerEvents: "none" as const, boxShadow: "0 4px 20px #00000066",
  },

  modalOverlay: { position: "fixed", inset: 0, background: "#000000aa", backdropFilter: "blur(5px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" },
  modal:        { background: "#0d0d14", border: "1px solid #2a2a3c", borderRadius: "20px", padding: "28px 26px 24px", maxWidth: "360px", width: "90vw", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", boxShadow: "0 32px 96px #000000dd" },
  modalIcon:    { width: "52px", height: "52px", borderRadius: "16px", background: "#f871710a", border: "1px solid #f8717130", display: "flex", alignItems: "center", justifyContent: "center" },
  modalTitle:   { fontSize: "16px", fontWeight: 600, color: "#e0e0ec", fontFamily: "'DM Sans',sans-serif" },
  modalSource:  { fontSize: "11px", color: "#c9a84c", fontFamily: "'DM Mono',monospace", background: "#c9a84c0a", border: "1px solid #c9a84c20", borderRadius: "8px", padding: "4px 14px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  modalWarning: { fontSize: "12px", color: "#5a5a70", fontFamily: "'DM Sans',sans-serif", lineHeight: "1.65", textAlign: "center" as const },
  modalActions: { display: "flex", gap: "10px", width: "100%", marginTop: "2px" },
  modalCancel:  { flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #222230", background: "transparent", color: "#6b6b78", fontSize: "12px", fontFamily: "'DM Mono',monospace", cursor: "pointer", letterSpacing: "0.04em", transition: "border-color 0.15s" },
  modalDelete:  { flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: "#f8717118", color: "#f87171", fontSize: "12px", fontFamily: "'DM Mono',monospace", cursor: "pointer", letterSpacing: "0.04em", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", transition: "background 0.2s" },
}