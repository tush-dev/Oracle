import { Router, type Request, type Response } from "express";
import { requireClerkSession } from "../middleware/requireClerk.js";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  parseSignedClerkUserId,
  saveGithubTokenForClerkUser,
  getGithubConnectionStatus,
} from "../services/githubOAuthService.js";

const router = Router();

function frontendBase(): string {
  const explicit = process.env.FRONTEND_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const fromList = process.env.FRONTEND_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean)[0];
  if (fromList) return fromList.replace(/\/$/, "");
  return "https://advanced-rag-pipeline.vercel.app";
}

router.get("/start", requireClerkSession, (req: Request, res: Response) => {
  try {
    const url = buildAuthorizeUrl(req.clerkUserId!);
    res.json({ url });
  } catch (e) {
    console.error("GitHub OAuth start:", e);
    res.status(503).json({
      error: "GitHub sign-in is not configured on the server.",
    });
  }
});

router.get("/status", requireClerkSession, async (req: Request, res: Response) => {
  try {
    const status = await getGithubConnectionStatus(req.supabaseUserId!);
    res.json(status);
  } catch (e) {
    console.error("GitHub status:", e);
    res.status(500).json({ error: "Could not load GitHub connection status." });
  }
});

router.get("/callback", async (req: Request, res: Response) => {
  const base = frontendBase();
  const fail = (code: string) =>
    res.redirect(302, `${base}/?github_error=${encodeURIComponent(code)}`);

  const err = typeof req.query.error === "string" ? req.query.error : null;
  if (err) {
    return fail(err === "access_denied" ? "access_denied" : "oauth_error");
  }

  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  if (!code || !state) {
    return fail("missing_code_or_state");
  }

  const clerkUserId = parseSignedClerkUserId(state);
  if (!clerkUserId) {
    return fail("invalid_state");
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    await saveGithubTokenForClerkUser(clerkUserId, accessToken);
  } catch (e) {
    console.error("GitHub OAuth callback:", e);
    return fail("token_exchange_failed");
  }

  res.redirect(302, `${base}/?github=connected`);
});

export default router;
