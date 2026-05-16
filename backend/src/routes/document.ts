import { Router, type Request, type Response } from "express"
import { requireClerkSession } from "../middleware/requireClerk.js"
import { Pinecone } from "@pinecone-database/pinecone"
import { createClient } from "@supabase/supabase-js"

const router   = Router()
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
const index    = pinecone.index("rag-index")

router.use(requireClerkSession)

// ─────────────────────────────────────────────────────────────
// GET /documents/list
// Returns all PDFs + repos for this user from Supabase
// PDFs come from documents table, repos from repo_trees table
// ─────────────────────────────────────────────────────────────
router.get("/list", async (req: Request, res: Response) => {
  try {
    const userId = req.supabaseUserId!

    // Fetch PDFs from documents table
    const { data: docRows, error: docError } = await supabase
      .from("documents")
      .select("source, uploaded_at")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false })

    if (docError) throw docError

    // Fetch repos from repo_trees table
    const { data: repoRows, error: repoError } = await supabase
      .from("repo_trees")
      .select("repo_name, indexed_at")
      .eq("user_id", userId)
      .order("indexed_at", { ascending: false })

    if (repoError) throw repoError

    // Deduplicate PDFs by source
    const seen    = new Set<string>()
    const pdfDocs = (docRows ?? []).filter((row: any) => {
      if (seen.has(row.source)) return false
      seen.add(row.source)
      return true
    }).map((row: any) => ({
      source:     row.source,
      uploadedAt: typeof row.uploaded_at === "number"
        ? row.uploaded_at
        : new Date(row.uploaded_at).getTime(),
    }))

    // Map repos to same shape with github: prefix
    const repoDocs = (repoRows ?? []).map((row: any) => ({
      source:     `github:${row.repo_name}`,
      uploadedAt: row.indexed_at,
    }))

    // Combine — PDFs first, then repos
    const documents = [...pdfDocs, ...repoDocs]

    console.log(`✅ Documents list: ${pdfDocs.length} PDFs + ${repoDocs.length} repos`)
    res.json({ documents })

  } catch (err) {
    console.error("GET /documents/list error:", err)
    res.status(500).json({ error: "Failed to fetch documents" })
  }
})

// ─────────────────────────────────────────────────────────────
// DELETE /documents/delete
// Body: { source: string }
// Handles both PDFs (source = filename) and repos (source = github:owner/repo)
// Deletes from Pinecone + Supabase
// ─────────────────────────────────────────────────────────────
router.delete("/delete", async (req: Request, res: Response) => {
  try {
    const userId          = req.supabaseUserId!
    const { source }      = req.body as { source?: string }

    if (!source?.trim()) {
      res.status(400).json({ error: "source is required" })
      return
    }

    const isRepo = source.startsWith("github:")
    console.log(`🗑  Delete — user: ${userId}  source: ${source}  type: ${isRepo ? "repo" : "pdf"}`)

    // ── 1. Collect Pinecone vector IDs ──────────────────────
    const queryRes = await index.query({
      vector:          new Array(1024).fill(0),
      topK:            10000,
      includeMetadata: false,
      filter: {
        $and: [
          { userId: { $eq: userId } },
          { source: { $eq: source  } },
        ],
      },
    })

    const ids = (queryRes.matches ?? []).map(m => m.id)
    console.log(`  📋 Found ${ids.length} vectors to delete`)

    // ── 2. Delete from Pinecone in batches ──────────────────
    if (ids.length > 0) {
      const BATCH = 1000
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH)
        await index.deleteMany({ ids: batch })
        console.log(`  🗑  Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(ids.length / BATCH)} deleted`)
      }
    }

    console.log(`  ✅ Pinecone: ${ids.length} vectors removed`)

    // ── 3. Delete from Supabase ─────────────────────────────
    if (isRepo) {
      // Repo — delete from repo_trees
      const repoName = source.replace("github:", "")
      const { error } = await supabase
        .from("repo_trees")
        .delete()
        .eq("user_id",  userId)
        .eq("repo_name", repoName)

      if (error) {
        console.error("  ❌ Supabase repo_trees delete error:", error)
        res.status(207).json({
          success: false,
          message: "Deleted from Pinecone but Supabase deletion failed",
          pineconeVectorsDeleted: ids.length,
        })
        return
      }
      console.log(`  ✅ Supabase repo_trees: deleted ${repoName}`)
    } else {
      // PDF — delete from documents
      const { error, count } = await supabase
        .from("documents")
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .eq("source",  source)

      if (error) {
        console.error("  ❌ Supabase documents delete error:", error)
        res.status(207).json({
          success: false,
          message: "Deleted from Pinecone but Supabase deletion failed",
          pineconeVectorsDeleted: ids.length,
        })
        return
      }
      console.log(`  ✅ Supabase documents: deleted ${count ?? "?"} rows`)
    }

    res.json({
      success:                true,
      source,
      pineconeVectorsDeleted: ids.length,
    })

  } catch (err) {
    console.error("DELETE /documents/delete error:", err)
    res.status(500).json({ error: "Failed to delete document" })
  }
})

export default router