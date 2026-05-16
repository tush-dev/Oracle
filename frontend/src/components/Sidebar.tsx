import { motion, AnimatePresence } from "framer-motion";

interface Chat { id: string; title: string; created_at: string }

interface Props {
  open: boolean;
  chats: Chat[];
  activeChatId: string | null;
  loading: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const Sidebar = ({ open, chats, activeChatId, loading, onClose, onNewChat, onSelectChat, onDeleteChat }: Props) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div style={s.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
        <motion.div style={s.sidebar} initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: "spring", damping: 28, stiffness: 260 }}>

          <div style={s.header}>
            <span style={s.title}>CHAT HISTORY</span>
            <button onClick={onClose} style={s.closeBtn}>✕</button>
          </div>

          <button onClick={() => { onNewChat(); onClose(); }} style={s.newBtn}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            NEW CHAT
          </button>

          <div style={s.divider} />

          <div style={s.list}>
            {loading ? (
              <div style={s.loadingWrap}>
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} style={s.skeleton} animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                ))}
              </div>
            ) : chats.length === 0 ? (
              <div style={s.empty}>No previous chats</div>
            ) : (
              chats.map((chat) => (
                <motion.div
                  key={chat.id}
                  style={{ ...s.item, ...(activeChatId === chat.id ? s.itemActive : {}) }}
                  onClick={() => onSelectChat(chat.id)}
                  whileHover={{ background: "#16161f" }}
                >
                  <div style={s.itemInner}>
                    <div style={s.itemIcon}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                    </div>
                    <div style={s.itemContent}>
                      <span style={s.itemTitle}>{chat.title}</span>
                      <span style={s.itemDate}>{formatDate(chat.created_at)}</span>
                    </div>
                    <button onClick={(e) => onDeleteChat(chat.id, e)} style={s.deleteBtn} title="Delete">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                  {activeChatId === chat.id && <div style={s.activeBar} />}
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "#00000066", zIndex: 10, backdropFilter: "blur(2px)" },
  sidebar: { position: "fixed", top: 0, left: 0, bottom: 0, width: "300px", zIndex: 11, background: "#0a0a10", borderRight: "1px solid #1e1e2a", display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 18px 16px", borderBottom: "1px solid #1a1a24" },
  title: { fontSize: "10px", letterSpacing: "0.25em", color: "#c9a84c", fontWeight: 600 },
  closeBtn: { background: "none", border: "none", cursor: "pointer", color: "#4a4a58", fontSize: "12px", padding: "2px 6px" },
  newBtn: { display: "flex", alignItems: "center", gap: "8px", margin: "12px", padding: "10px 14px", borderRadius: "10px", border: "1px dashed #2a2a38", background: "transparent", color: "#6b6b78", fontSize: "10px", letterSpacing: "0.15em", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Mono',monospace" },
  divider: { height: "1px", background: "#1a1a24", margin: "0 12px" },
  list: { flex: 1, overflowY: "auto", padding: "8px 0", scrollbarWidth: "thin", scrollbarColor: "#222230 transparent" },
  loadingWrap: { display: "flex", flexDirection: "column", gap: "8px", padding: "12px" },
  skeleton: { height: "56px", borderRadius: "10px", background: "#141420" },
  empty: { fontSize: "12px", color: "#3a3a48", textAlign: "center", padding: "32px 16px" },
  item: { position: "relative", cursor: "pointer", borderRadius: "10px", margin: "2px 8px", padding: "10px 12px", transition: "background 0.15s" },
  itemActive: { background: "#141420" },
  activeBar: { position: "absolute", left: 0, top: "20%", bottom: "20%", width: "2px", borderRadius: "0 2px 2px 0", background: "#c9a84c" },
  itemInner: { display: "flex", alignItems: "center", gap: "10px" },
  itemIcon: { color: "#3a3a50", flexShrink: 0 },
  itemContent: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" },
  itemTitle: { fontSize: "12px", color: "#b0b0c0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'DM Sans',sans-serif" },
  itemDate: { fontSize: "10px", color: "#3a3a50", letterSpacing: "0.04em" },
  deleteBtn: { background: "none", border: "none", cursor: "pointer", color: "#3a3a50", padding: "4px", borderRadius: "6px", flexShrink: 0 },
};