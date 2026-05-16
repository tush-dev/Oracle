import { useEffect } from "react";

const API =
  import.meta.env.VITE_API_URL ?? "http://localhost:3009";

/**
 * GitHub redirects here (public URL in OAuth app settings). This page immediately
 * forwards the same query string to the API, which exchanges the code and redirects
 * back to the app with ?github=connected or ?github_error=...
 */
export default function GithubOAuthCallbackBridge() {
  useEffect(() => {
    const search = window.location.search;
    if (!search || search === "?") {
      window.location.replace("/");
      return;
    }
    window.location.replace(`${API}/auth/github/callback${search}`);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#08080a",
        color: "#9a9aa8",
        fontFamily: "'DM Mono', ui-monospace, monospace",
        fontSize: 12,
        letterSpacing: "0.12em",
      }}
    >
      Completing GitHub sign-in…
    </div>
  );
}
