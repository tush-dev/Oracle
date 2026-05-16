import { createHmac, timingSafeEqual } from "node:crypto";
import { supabase } from "../lib/supabase.js";
import { ensureSupabaseUser, getPrimaryEmail } from "./userService.js";

export async function getUserGithubToken(
  userId: string   // ← this is supabase UUID
): Promise<string | null> {

  console.log("🔍 Looking for token with supabase userId:", userId)

  const { data, error } = await supabase
    .from('users')
    .select('github_access_token')
    .eq('id', userId)              // ← changed from clerk_user_id to id
    .single()

  console.log("🔍 Query result:", data)
  console.log("🔍 Error:", error)

  if (error || !data?.github_access_token) return null
  return data.github_access_token
}

const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  const s =
    process.env.GITHUB_OAUTH_STATE_SECRET ?? process.env.CLERK_SECRET_KEY;
  if (!s) throw new Error("GITHUB_OAUTH_STATE_SECRET or CLERK_SECRET_KEY required");
  return s;
}

function githubEnv() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_OAUTH_REDIRECT_URI",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl(clerkUserId: string): string {
  const { clientId, redirectUri } = githubEnv();
  const payload = Buffer.from(
    JSON.stringify({ sub: clerkUserId, exp: Date.now() + STATE_TTL_MS }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("hex");
  const state = `${payload}.${sig}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: process.env.GITHUB_OAUTH_SCOPES ?? "read:user user:email",
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length || ba.length === 0) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function parseSignedClerkUserId(state: string): string | null {
  const lastDot = state.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const payloadB64 = state.slice(0, lastDot);
  const sigHex = state.slice(lastDot + 1);
  const expectedHex = createHmac("sha256", stateSecret())
    .update(payloadB64)
    .digest("hex");
  if (!safeEqualHex(sigHex, expectedHex)) return null;
  let data: { sub?: string; exp?: number };
  try {
    data = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof data.sub !== "string" || typeof data.exp !== "number") return null;
  if (data.exp < Date.now()) return null;
  return data.sub;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = githubEnv();
  const formBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody,
  });
  const body = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || body.error || !body.access_token) {
    const msg = body.error_description ?? body.error ?? "token_exchange_failed";
    throw new Error(msg);
  }
  return body.access_token;
}

async function fetchGithubLogin(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { login?: string };
  return typeof u.login === "string" ? u.login : null;
}

export async function saveGithubTokenForClerkUser(
  clerkUserId: string,
  accessToken: string,
): Promise<void> {
  const email = await getPrimaryEmail(clerkUserId);
  const supabaseUserId = await ensureSupabaseUser(clerkUserId, email);
  const githubLogin = await fetchGithubLogin(accessToken);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("users")
    .update({
      github_access_token: accessToken,
      github_login: githubLogin,
      github_token_updated_at: now,
      updated_at: now,
    })
    .eq("id", supabaseUserId);
  if (error) throw error;
}

export async function getGithubConnectionStatus(supabaseUserId: string): Promise<{
  connected: boolean;
  githubLogin: string | null;
}> {
  const { data, error } = await supabase
    .from("users")
    .select("github_access_token, github_login")
    .eq("id", supabaseUserId)
    .maybeSingle();
  if (error) throw error;
  const connected = Boolean(data?.github_access_token);
  return {
    connected,
    githubLogin: data?.github_login ?? null,
  };
}
