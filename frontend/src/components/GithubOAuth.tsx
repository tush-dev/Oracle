import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/react";
import { useSearchParams } from "react-router-dom";

const API =
  import.meta.env.VITE_API_URL ?? "http://localhost:3009";

function GithubIcon({ muted }: { muted?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 98 96"
      aria-hidden
      style={{ display: "block", opacity: muted ? 0.45 : 1 }}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
      />
    </svg>
  );
}

export function GithubOAuth() {
  const { isSignedIn, getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!isSignedIn) {
      setStatusLoading(false);
      return;
    }
    setStatusLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setConnected(false);
        setGithubLogin(null);
        return;
      }
      const res = await fetch(`${API}/auth/github/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setConnected(false);
        setGithubLogin(null);
        return;
      }
      const data = (await res.json()) as {
        connected?: boolean;
        githubLogin?: string | null;
      };
      setConnected(Boolean(data.connected));
      setGithubLogin(data.githubLogin ?? null);
    } catch {
      setConnected(false);
      setGithubLogin(null);
    } finally {
      setStatusLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const gh = searchParams.get("github");
    const ghErr = searchParams.get("github_error");
    if (gh === "connected") {
      setBanner("GitHub connected");
      void loadStatus();
    } else if (ghErr) {
      const labels: Record<string, string> = {
        access_denied: "GitHub authorization cancelled",
        invalid_state: "GitHub sign-in expired — try again",
        token_exchange_failed: "Could not complete GitHub sign-in",
        missing_code_or_state: "GitHub sign-in incomplete",
        oauth_error: "GitHub sign-in failed",
      };
      setBanner(labels[ghErr] ?? "GitHub sign-in failed");
    }
    if (gh || ghErr) {
      const next = new URLSearchParams(searchParams);
      next.delete("github");
      next.delete("github_error");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, loadStatus]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 5000);
    return () => window.clearTimeout(t);
  }, [banner]);

  const startGithubAuth = async () => {
    if (!isSignedIn || busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) {
        setBanner("Sign in required");
        setBusy(false);
        return;
      }
      const res = await fetch(`${API}/auth/github/start`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        setBanner(
          typeof data.error === "string"
            ? data.error
            : "GitHub is not configured",
        );
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setBanner("Could not start GitHub sign-in");
      setBusy(false);
    }
  };

  if (!isSignedIn) return null;

  const title = connected
    ? githubLogin
      ? `GitHub connected as @${githubLogin} — click to reconnect`
      : "GitHub connected — click to reconnect"
    : "Connect GitHub";

  return (
    <div style={s.wrap}>
      {banner && (
        <motion.div
          style={s.banner}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {banner}
        </motion.div>
      )}
      <motion.button
        type="button"
        style={{
          ...s.btn,
          position: "relative",
          borderColor: connected ? "#c9a84c55" : "#222230",
          color: connected ? "#c9a84c" : "#9a9aa8",
        }}
        onClick={() => void startGithubAuth()}
        disabled={busy || statusLoading}
        title={title}
        whileHover={{ borderColor: "#c9a84c99", color: "#c9a84c" }}
        whileTap={{ scale: 0.95 }}
        aria-label={title}
      >
        <GithubIcon muted={busy || statusLoading} />
        {busy ? (
          <span style={s.btnHint}>…</span>
        ) : connected ? (
          <span style={s.dot} aria-hidden />
        ) : null}
      </motion.button>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: { position: "relative", display: "flex", alignItems: "center" },
  banner: {
    position: "absolute",
    right: 0,
    top: "100%",
    marginTop: "6px",
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid #c9a84c44",
    background: "#111118",
    color: "#c9a84c",
    fontSize: "10px",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
    zIndex: 20,
    boxShadow: "0 8px 24px #00000066",
  },
  btn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    width: "40px",
    height: "36px",
    borderRadius: "10px",
    border: "1px solid #222230",
    background: "#111118",
    cursor: "pointer",
    flexShrink: 0,
    transition: "color 0.2s, border-color 0.2s",
    fontFamily: "'DM Mono',monospace",
  },
  btnHint: { fontSize: "10px", color: "#6b6b78" },
  dot: {
    position: "absolute",
    top: "6px",
    right: "6px",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#4ade80",
    boxShadow: "0 0 6px #4ade8088",
  },
};
