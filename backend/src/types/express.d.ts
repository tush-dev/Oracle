declare module "express-serve-static-core" {
  interface Request {
    clerkUserId?: string;
    supabaseUserId?: string;
  }
}

export {};
