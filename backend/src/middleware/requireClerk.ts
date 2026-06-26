import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { ensureSupabaseUser, getPrimaryEmail } from "../services/userService.js";

// Middleware that requires an authenticated Clerk session and ensures the request
// is attached to a Supabase user record for downstream route handlers.
export async function requireClerkSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const secretKey = (process.env.CLERK_SECRET_KEY ?? "").trim();
  if (!secretKey) {
    console.error("Auth misconfiguration: Clerk secret key is not set or empty");
    return res.status(500).json({
      error: "Service temporarily unavailable. Please try again later.",
    });
  }
  console.error("[auth] CLERK_SECRET_KEY prefix:", secretKey.substring(0, 7) + "...");

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Sign in required." });
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ error: "Sign in required." });
  }

  const tokenParts = token.split(".");
  if (tokenParts.length !== 3) {
    return res.status(401).json({ error: "Invalid token format." });
  }

  try {
    const decodedHeader = JSON.parse(
      Buffer.from(tokenParts[0]!, "base64url").toString("utf-8"),
    );
    console.error(
      "[auth] Token header — alg:", decodedHeader.alg, "kid:", decodedHeader.kid, "typ:", decodedHeader.typ,
    );
  } catch {
    // ignore parse errors
  }

  try {
    const payload = await verifyToken(token, { secretKey });
    const clerkUserId = payload.sub;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Invalid session." });
    }

    const email = await getPrimaryEmail(clerkUserId);
    const supabaseUserId = await ensureSupabaseUser(clerkUserId, email);

    req.clerkUserId = clerkUserId;
    req.supabaseUserId = supabaseUserId;
    next();
  } catch (err: unknown) {
    console.error("Clerk token verification failed — full error:", err);
    console.error("Clerk token verification failed — type:", typeof err, "isError:", err instanceof Error);
    if (err instanceof Error) {
      console.error("Clerk token verification failed — message:", err.message);
      console.error("Clerk token verification failed — stack:", err.stack);
      console.error("Clerk token verification failed — cause:", (err as any).cause);
      console.error("Clerk token verification failed — reason:", (err as any).reason);
      console.error("Clerk token verification failed — action:", (err as any).action);
    }
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}
