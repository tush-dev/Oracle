import { motion, AnimatePresence } from "framer-motion";

interface HistoryItem { q: string; a: string }

interface Props {
  history: HistoryItem[];
  isStreaming: boolean;
  response: string;
  currentQ: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export const MessageList = ({ history, isStreaming, response, currentQ, scrollRef }: Props) => {
  const isEmpty = history.length === 0 && !isStreaming && !response;

  return (
    <div style={s.body} ref={scrollRef}>
      <AnimatePresence>
        {isEmpty && (
          <motion.div style={s.emptyState} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.6 }}>
            <div style={s.emptyOrb}>
              <motion.div style={s.emptyOrbRing} animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} />
              <motion.div style={s.emptyOrbRing2} animate={{ rotate: -360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div style={s.emptyTitle}>Begin your inquiry</div>
            <div style={s.emptyDesc}>
  Ask anything — upload a PDF, drop a question,
  <br />
  or paste a GitHub URL to explore any codebase.
</div>
            <div style={s.emptyTags}>
              {["Document Analysis", "Semantic Search", "RAG Pipeline", "Knowledge Retrieval"].map((t) => (
                <span key={t} style={s.emptyTag}>{t}</span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {history.map((item, i) => (
        <motion.div key={i} style={s.turn} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
          <div style={s.questionRow}>
            <div style={s.questionBubble}>
              <span style={s.questionLabel}>YOU</span>
              <p style={s.questionText}>{item.q}</p>
            </div>
          </div>
          <div style={s.answerRow}>
            <div style={s.answerAvatar}><div style={s.avatarInner}>O</div></div>
            <div style={s.answerCard}>
              <div style={s.answerBar} />
              <span style={s.answerLabel}>ORACLE</span>
              <p style={s.answerText}>{item.a}</p>
            </div>
          </div>
        </motion.div>
      ))}

      <AnimatePresence>
        {isStreaming && (
          <motion.div style={s.turn} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {currentQ && (
              <div style={s.questionRow}>
                <div style={s.questionBubble}>
                  <span style={s.questionLabel}>YOU</span>
                  <p style={s.questionText}>{currentQ}</p>
                </div>
              </div>
            )}
            <div style={s.answerRow}>
              <div style={s.answerAvatar}>
                <motion.div style={s.avatarInner} animate={{ boxShadow: ["0 0 0px #c9a84c00", "0 0 16px #c9a84c88", "0 0 0px #c9a84c00"] }} transition={{ duration: 1.5, repeat: Infinity }}>O</motion.div>
              </div>
              <div style={s.answerCard}>
                <div style={s.answerBar} />
                <div style={s.answerHeaderRow}>
                  <span style={s.answerLabel}>ORACLE</span>
                  <div style={s.generatingBadge}>
                    <motion.span style={s.genDot} animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
                    <span style={s.genLabel}>GENERATING</span>
                  </div>
                </div>
                {response === "" ? (
                  <div style={s.thinkRow}>
                    {[0, 1, 2].map((j) => (
                      <motion.span key={j} style={s.thinkDot} animate={{ y: [0, -7, 0], opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.85, repeat: Infinity, delay: j * 0.16, ease: "easeInOut" }} />
                    ))}
                  </div>
                ) : (
                  <p style={s.answerText}>
                    {response}
                    <motion.span style={s.cursor} animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} />
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  body: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "8px 4px 16px", scrollbarWidth: "thin", scrollbarColor: "#222230 transparent", display: "flex", flexDirection: "column", gap: "32px" },
  emptyState: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: "20px", textAlign: "center" },
  emptyOrb: { width: "80px", height: "80px", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" },
  emptyOrbRing: { position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid transparent", borderTopColor: "#c9a84c66", borderRightColor: "#c9a84c22" },
  emptyOrbRing2: { position: "absolute", inset: "8px", borderRadius: "50%", border: "1px solid transparent", borderBottomColor: "#c9a84c44", borderLeftColor: "#c9a84c11" },
  emptyTitle: { fontSize: "20px", fontWeight: 600, letterSpacing: "0.05em", color: "#c8c8d8", fontFamily: "'DM Sans','Segoe UI',sans-serif" },
  emptyDesc: { fontSize: "13px", color: "#4a4a5a", lineHeight: "1.8", fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: "360px" },
  emptyTags: { display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "8px" },
  emptyTag: { fontSize: "10px", letterSpacing: "0.12em", padding: "5px 12px", borderRadius: "999px", border: "1px solid #222230", color: "#4a4a58", background: "#111118" },
  turn: { display: "flex", flexDirection: "column", gap: "16px" },
  questionRow: { display: "flex", justifyContent: "flex-end" },
  questionBubble: { maxWidth: "70%", background: "#141420", border: "1px solid #252535", borderRadius: "16px 16px 4px 16px", padding: "14px 18px" },
  questionLabel: { fontSize: "9px", letterSpacing: "0.2em", color: "#6b6b78", display: "block", marginBottom: "6px" },
  questionText: { margin: 0, fontSize: "14px", lineHeight: "1.7", color: "#c8c8d8", fontFamily: "'DM Sans','Segoe UI',sans-serif", fontWeight: 400 },
  answerRow: { display: "flex", gap: "14px", alignItems: "flex-start" },
  answerAvatar: { width: "38px", height: "38px", flexShrink: 0, borderRadius: "50%", border: "1.5px solid #c9a84c44", display: "flex", alignItems: "center", justifyContent: "center", background: "#111118" },
  avatarInner: { fontSize: "14px", fontWeight: 700, color: "#c9a84c", letterSpacing: "0.05em" },
  answerCard: { flex: 1, background: "#0e0e14", border: "1px solid #1e1e2a", borderRadius: "4px 16px 16px 16px", padding: "16px 18px", position: "relative", overflow: "hidden" },
  answerBar: { position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, #c9a84c 0%, #c9a84c55 60%, transparent 100%)" },
  answerHeaderRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" },
  answerLabel: { fontSize: "9px", letterSpacing: "0.2em", color: "#c9a84c88", display: "block" },
  answerText: { margin: 0, fontSize: "14px", lineHeight: "1.85", color: "#d0d0e0", fontFamily: "'DM Sans','Segoe UI',sans-serif", whiteSpace: "pre-wrap", fontWeight: 400 },
  generatingBadge: { display: "flex", alignItems: "center", gap: "5px", padding: "2px 9px", borderRadius: "999px", border: "1px solid #c9a84c33", background: "#c9a84c0a" },
  genDot: { display: "inline-block", width: "5px", height: "5px", borderRadius: "50%", background: "#c9a84c" },
  genLabel: { fontSize: "8px", letterSpacing: "0.2em", color: "#c9a84c88", fontWeight: 600 },
  thinkRow: { display: "flex", gap: "7px", alignItems: "center", padding: "6px 0" },
  thinkDot: { display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#c9a84c" },
  cursor: { display: "inline-block", width: "2px", height: "14px", background: "#c9a84c", borderRadius: "1px", marginLeft: "2px", verticalAlign: "text-bottom" },
};