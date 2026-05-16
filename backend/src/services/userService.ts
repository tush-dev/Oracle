import { randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { supabase } from "../lib/supabase.js";

const emailCache = new Map<string, { email: string; exp: number }>();
const CACHE_MS = 120_000;

function getClerk() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error("Clerk client misconfiguration: secret key is not set");
    throw new Error("Clerk client is not configured");
  }
  return createClerkClient({ secretKey });
}

export async function getPrimaryEmail(clerkUserId: string): Promise<string> {
  const now = Date.now();
  const hit = emailCache.get(clerkUserId);
  if (hit && hit.exp > now) return hit.email;

  const clerk = getClerk();
  const user = await clerk.users.getUser(clerkUserId);
  const primaryId = user.primaryEmailAddressId;
  const email =
    user.emailAddresses.find((e) => e.id === primaryId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "";

  emailCache.set(clerkUserId, { email, exp: now + CACHE_MS });
  return email;
}

/** Resolves or creates the Supabase `users.id` (UUID) for this Clerk user. */
export async function ensureSupabaseUser(
  clerkUserId: string,
  email: string,
): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from("users")
    .select("id,email")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (selErr) throw selErr;

  if (existing) {
    if (email && existing.email !== email) {
      const { error: upErr } = await supabase
        .from("users")
        .update({
          email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (upErr) throw upErr;
    }
    return existing.id;
  }

  const id = randomUUID();
  const { error: insErr } = await supabase.from("users").insert({
    id,
    clerk_user_id: clerkUserId,
    email: email || null,
  });

  if (insErr?.code === "23505") {
    const { data: retry, error: rErr } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .single();
    if (rErr) throw rErr;
    if (retry) return retry.id;
  }

  if (insErr) throw insErr;
  return id;
}
