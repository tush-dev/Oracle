import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Props {
  signedIn:    boolean
  isIndexing:  boolean
  onIndex:     (url: string) => void
  onClose:     () => void
}


// Validate GitHub URL on frontend before sending
function validateGithubUrl(url: string): string | null {
  if (!url.trim()) return 'Please enter a GitHub URL'
  if (!url.includes('github.com')) return 'Must be a GitHub URL'
  const match = url.match(/github\.com\/([^/]+)\/([^/\s]+)/)
  if (!match) return 'Format: https://github.com/owner/repo'
  return null  // null = valid
}

export const RepoInput = ({ isIndexing, onIndex, onClose }: Props) => {
  const [url,   setUrl]   = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    const validationError = validateGithubUrl(url)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    onIndex(url.trim())
  }

  return (
    <motion.div
      style={s.wrap}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          {/* GitHub icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#6b6b78">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <span style={s.title}>Index GitHub Repository</span>
        </div>
        <button type="button" onClick={onClose} style={s.closeBtn}>✕</button>
      </div>

      {/* URL input */}
      <div style={s.inputRow}>
        <input
          style={{
            ...s.input,
            ...(error ? s.inputError : {}),
          }}
          type="text"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null) }}
          onKeyDown={(e) => e.key === 'Enter' && !isIndexing && handleSubmit()}
          disabled={isIndexing}
          autoFocus
        />

        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={isIndexing || !url.trim()}
          style={{
            ...s.indexBtn,
            ...((isIndexing || !url.trim()) ? s.indexBtnOff : {})
          }}
          whileHover={!isIndexing && url.trim() ? { scale: 1.04 } : {}}
          whileTap={!isIndexing && url.trim() ? { scale: 0.95 } : {}}
        >
          {isIndexing ? (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
            >
              indexing…
            </motion.span>
          ) : 'Index'}
        </motion.button>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            style={s.errorMsg}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            ⚠ {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint */}
      {!error && (
        <div style={s.hint}>
          Public repos only · node_modules, dist and binaries are skipped automatically
        </div>
      )}

      {/* Progress indicator when indexing */}
      <AnimatePresence>
        {isIndexing && (
          <motion.div
            style={s.progressWrap}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              style={s.progressBar}
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span style={s.progressText}>
              Fetching files, chunking and embedding — this may take a minute…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    background:   "#0e0e14",
    border:       "1px solid #1e1e2c",
    borderRadius: "14px",
    padding:      "14px 16px",
    display:      "flex",
    flexDirection: "column",
    gap:          "10px",
  },
  header: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
  },
  title: {
    fontSize:      "11px",
    color:         "#9a9ab0",
    fontFamily:    "'DM Mono',monospace",
    letterSpacing: "0.06em",
  },
  closeBtn: {
    background: "none",
    border:     "none",
    color:      "#3a3a50",
    cursor:     "pointer",
    fontSize:   "12px",
    padding:    "2px 6px",
    borderRadius: "6px",
  },
  inputRow: {
    display: "flex",
    gap:     "8px",
  },
  input: {
    flex:          1,
    background:    "#0a0a10",
    border:        "1px solid #222230",
    borderRadius:  "10px",
    padding:       "9px 14px",
    color:         "#e0e0ec",
    fontSize:      "12px",
    fontFamily:    "'DM Mono',monospace",
    outline:       "none",
    letterSpacing: "0.02em",
  },
  inputError: {
    borderColor: "#f8717166",
  },
  indexBtn: {
    padding:      "9px 18px",
    borderRadius: "10px",
    border:       "none",
    background:   "linear-gradient(135deg, #c9a84c 0%, #9a7228 100%)",
    color:        "#08080a",
    fontSize:     "11px",
    fontFamily:   "'DM Mono',monospace",
    fontWeight:   600,
    cursor:       "pointer",
    flexShrink:   0,
    letterSpacing: "0.04em",
  },
  indexBtnOff: {
    opacity: 0.3,
    cursor:  "not-allowed",
  },
  errorMsg: {
    fontSize:   "10px",
    color:      "#f87171",
    fontFamily: "'DM Mono',monospace",
    padding:    "4px 2px",
  },
  hint: {
    fontSize:      "9px",
    color:         "#2e2e3c",
    fontFamily:    "'DM Mono',monospace",
    letterSpacing: "0.04em",
  },
  progressWrap: {
    position:     "relative",
    height:       "2px",
    background:   "#1a1a24",
    borderRadius: "2px",
    overflow:     "hidden",
    marginTop:    "4px",
  },
  progressBar: {
    position:   "absolute",
    inset:      0,
    background: "linear-gradient(90deg, transparent, #c9a84c, transparent)",
    width:      "40%",
  },
  progressText: {
    position:   "absolute",
    top:        "8px",
    left:       0,
    fontSize:   "9px",
    color:      "#3a3a50",
    fontFamily: "'DM Mono',monospace",
    whiteSpace: "nowrap",
  },
}