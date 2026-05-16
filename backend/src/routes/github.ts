import { Router, type Request, type Response } from "express"
import { createClient } from "@supabase/supabase-js"
import { requireClerkSession } from "../middleware/requireClerk.js"
import { indexGithubRepo, parseGithubUrl } from "../rag/githubIndexer.js"

const router   = Router()
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

router.use(requireClerkSession)

// ─────────────────────────────────────────────────────────────
// POST /github/index
// ─────────────────────────────────────────────────────────────
router.post("/index", async (req: Request, res: Response) => {
  const { repoUrl } = req.body as { repoUrl?: string }
  const userId      = req.supabaseUserId!

  if (!repoUrl?.trim()) {
    return res.status(400).json({ error: "No repository URL provided" })
  }

  const parsed = parseGithubUrl(repoUrl)
  if (!parsed) {
    return res.status(400).json({
      error: "Invalid GitHub URL. Format: https://github.com/owner/repo"
    })
  }

  try {
    console.log(`\n🐙 Index request: ${repoUrl} by user ${userId}`)

    const result = await indexGithubRepo(repoUrl, userId)

    // Save tree to repo_trees in Supabase
    const { error: treeError } = await supabase
      .from("repo_trees")
      .upsert(
        {
          user_id:    userId,
          repo_url:   repoUrl,
          repo_name:  result.repoName,
          tree:       result.tree,
          file_count: result.fileCount,
          indexed_at: Date.now(),
        },
        { onConflict: "user_id,repo_url" }
      )

    if (treeError) {
      console.warn("⚠️  Failed to save repo tree to Supabase:", treeError.message)
    } else {
      console.log("✅ Repo tree saved to Supabase")
    }

    return res.json({
      success:      true,
      repoName:     result.repoName,
      fileCount:    result.fileCount,
      chunkCount:   result.chunkCount,
      skippedCount: result.skippedCount,
      tree:         result.tree,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to index repository"
    console.error("GitHub indexing error:", err)

    if (msg.includes("not found or is private")) return res.status(404).json({ error: msg })
    if (msg.includes("rate limit"))              return res.status(429).json({ error: msg })
    if (msg.includes("No indexable") || msg.includes("No content")) return res.status(422).json({ error: msg })

    return res.status(500).json({ error: msg })
  }
})

// ─────────────────────────────────────────────────────────────
// GET /github/repos
// ─────────────────────────────────────────────────────────────
router.get("/repos", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("repo_trees")
      .select("repo_name, repo_url, file_count, indexed_at")
      .eq("user_id", req.supabaseUserId!)
      .order("indexed_at", { ascending: false })

    if (error) throw error

    return res.json({
      repos: (data ?? []).map((r: any) => ({
        repoName:  r.repo_name,
        repoUrl:   r.repo_url,
        fileCount: r.file_count,
        indexedAt: r.indexed_at,
      }))
    })
  } catch (err) {
    console.error("Failed to fetch repos:", err)
    return res.status(500).json({ error: "Failed to fetch repositories" })
  }
})

export default router