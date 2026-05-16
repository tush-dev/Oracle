import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { ensureSupabaseUser, getPrimaryEmail } from "../services/userService.js";

export async function requireClerkSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error("Auth misconfiguration: Clerk secret key is not set");
    return res.status(500).json({
      error: "Service temporarily unavailable. Please try again later.",
    });
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Sign in required." });
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ error: "Sign in required." });
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
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}
