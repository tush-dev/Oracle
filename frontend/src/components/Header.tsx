import { motion } from "framer-motion";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/react";
import { GithubOAuth } from "./GithubOAuth";

interface Props {
  chatId: string | null;
  file: File | null;
  fileName: string;
  onRemoveFile: () => void;
  onNewChat: () => void;
  onOpenSidebar: () => void;
}

export const Header = ({ chatId, file, fileName, onRemoveFile, onNewChat, onOpenSidebar }: Props) => (
  <motion.header
    style={s.header}
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      <motion.button
        onClick={onOpenSidebar}
        style={s.sidebarToggle}
        whileHover={{ borderColor: "#c9a84c99", color: "#c9a84c" }}
        whileTap={{ scale: 0.95 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </motion.button>

      <div style={s.brand}>
        <div style={s.brandIcon}>
          <motion.div style={s.brandRing} animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} />
          <div style={s.brandCore} />
        </div>
        <div>
          <div style={s.brandName}>ORACLE</div>
          <div style={s.brandSub}>RAG Intelligence Engine</div>
        </div>
      </div>
    </div>

    <div style={s.headerRight}>
      {chatId && (
        <motion.div style={s.chatIdPill} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}>
          <span style={s.chatIdText}>#{chatId.slice(0, 8)}</span>
        </motion.div>
      )}

      {file && (
        <motion.div style={s.headerFilePill} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span style={s.headerFileText}>{fileName}</span>
          <button onClick={onRemoveFile} style={s.headerFileX}>✕</button>
        </motion.div>
      )}

      <motion.button onClick={onNewChat} style={s.newChatBtn} whileHover={{ borderColor: "#c9a84c99", color: "#c9a84c" }} whileTap={{ scale: 0.95 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        NEW CHAT
      </motion.button>

      <div style={s.livePill}>
        <motion.span style={s.liveDot} animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }} transition={{ duration: 2, repeat: Infinity }} />
        <span style={s.liveLabel}>LIVE</span>
      </div>

      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" style={s.authTrigger}>
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" style={{ ...s.authTrigger, color: "#9a9aa8" }}>
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <GithubOAuth />
        <UserButton
          appearance={{
            elements: {
              userButtonAvatarBox: { width: 32, height: 32 },
            },
          }}
        />
      </Show>
    </div>
  </motion.header>
);

const s: Record<string, React.CSSProperties> = {
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexShrink: 0, padding: "0 4px" },
  brand: { display: "flex", alignItems: "center", gap: "14px" },
  brandIcon: { width: "42px", height: "42px", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" },
  brandRing: { position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid transparent", borderTopColor: "#c9a84c", borderRightColor: "#c9a84c44" },
  brandCore: { width: "18px", height: "18px", borderRadius: "50%", background: "radial-gradient(circle, #c9a84c 0%, #7a5820 100%)", boxShadow: "0 0 12px #c9a84c60" },
  brandName: { fontSize: "16px", fontWeight: 700, letterSpacing: "0.3em", color: "#c9a84c", lineHeight: 1 },
  brandSub: { fontSize: "9px", letterSpacing: "0.15em", color: "#6b6b78", marginTop: "4px", fontWeight: 400 },
  headerRight: { display: "flex", alignItems: "center", gap: "10px" },
  chatIdPill: { display: "flex", alignItems: "center", padding: "5px 11px", borderRadius: "999px", border: "1px solid #c9a84c33", background: "#c9a84c0a" },
  chatIdText: { fontSize: "10px", color: "#c9a84c88", letterSpacing: "0.1em" },
  headerFilePill: { display: "flex", alignItems: "center", gap: "7px", padding: "5px 11px", borderRadius: "999px", border: "1px solid #4ade8033", background: "#4ade800d" },
  headerFileText: { fontSize: "10px", color: "#4ade80", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  headerFileX: { background: "none", border: "none", cursor: "pointer", color: "#6b6b78", fontSize: "10px", padding: 0, lineHeight: 1 },
  newChatBtn: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "999px", border: "1px solid #222230", background: "#111118", color: "#6b6b78", fontSize: "9px", letterSpacing: "0.15em", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Mono',monospace", transition: "all 0.2s" },
  livePill: { display: "flex", alignItems: "center", gap: "7px", padding: "6px 14px", borderRadius: "999px", border: "1px solid #222230", background: "#111118" },
  liveDot: { display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade8088" },
  liveLabel: { fontSize: "9px", letterSpacing: "0.2em", color: "#6b6b78", fontWeight: 600 },
  sidebarToggle: { display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "10px", border: "1px solid #222230", background: "#111118", color: "#6b6b78", cursor: "pointer", flexShrink: 0, transition: "all 0.2s" },
  authTrigger: { padding: "6px 12px", borderRadius: 999, border: "1px solid #222230", background: "#111118", color: "#c9a84c", fontSize: 9, letterSpacing: "0.12em", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" },
};