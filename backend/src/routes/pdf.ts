import type { Request, Response } from "express"
import { createClient } from "@supabase/supabase-js"
import { extractTextFromFile } from "../services/documentParseService.js"
import { chunkText } from "../rag/chunker.js"
import { embedChunks, embedQuery } from "../rag/embedder.js"
import { searchPinecone, storeInPinecone } from "../rag/pinecone.js"
import { hybridSearch } from "../rag/hybridSearch.js"
import { rerankChunks } from "../rag/reranker.js"
import {
  generateHypotheticalDocument,
  generateRepositorySearchQueries,
  isBroadRepositoryQuery,
} from "../rag/hyde.js"
import type { BM25Chunk } from "../rag/bm25.js"
import type { MetadataFilter } from "../rag/pinecone.js"
import { askGroq, isStructuralQuery } from "../rag/groq.js"
import { evalRAG } from "../rag/evaluator.js"
import {
  createChat,
  saveMessage,
  getChatMessagesForUser,
} from "../services/historyService.js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

function selectDiverseRepositoryChunks(chunks: string[], limit: number): string[] {
  const selected: string[] = []
  const overflow: string[] = []
  const fileCounts = new Map<string, number>()

  for (const chunk of chunks) {
    const filePath = chunk.match(/^\/\/ File: (.+)$/m)?.[1] ?? "(unknown)"
    const count    = fileCounts.get(filePath) ?? 0

    if (count < 3) {
      selected.push(chunk)
      fileCounts.set(filePath, count + 1)
    } else {
      overflow.push(chunk)
    }
  }

  // Keep enough evidence even when a small repository has only a few files.
  const minimum = Math.min(12, chunks.length, limit)
  return [...selected, ...overflow.slice(0, Math.max(0, minimum - selected.length))]
    .slice(0, limit)
}

function selectFacetEvidence(resultGroups: Awaited<ReturnType<typeof searchPinecone>>[]): string[] {
  const selected: string[] = []
  const seen = new Set<string>()

  for (const group of resultGroups) {
    let taken = 0

    for (const chunk of group) {
      if (seen.has(chunk.id)) continue

      selected.push(chunk.text)
      seen.add(chunk.id)
      taken += 1

      if (taken === 2) break
    }
  }

  return selected
}

const pdf = async (req: Request, res: Response) => {
  try {
    console.log("========== /query request ==========")
    console.log("BODY:", req.body)
    console.log("FILE FIELD:", req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    } : null)
    console.log("===================================")
    const file   = req.file
    const query  = req.body.query
    const userId = req.supabaseUserId!
    let   chatId = req.body.chatId

    const filterSource = req.body.filterSource as string | undefined
    const filterAfter  = req.body.filterAfter  as number | undefined
    const filterBefore = req.body.filterBefore as number | undefined

    if (!query || !query.trim()) {
      console.error("❌ Query missing. BODY received:", req.body)
      return res.status(400).json({
        error: "No query provided.",
        receivedBody: req.body,
      })
    }

    const metadataFilter: MetadataFilter | undefined = (() => {
      if (!filterSource && !filterAfter && !filterBefore) return undefined
      const filter: MetadataFilter = {}
      if (filterSource) filter.source = filterSource
      if (filterAfter || filterBefore) {
        filter.uploadedAt = {}
        if (filterAfter)  filter.uploadedAt.after  = filterAfter
        if (filterBefore) filter.uploadedAt.before = filterBefore
      }
      return filter
    })()

    let bm25Chunks: BM25Chunk[] = []

    // ── Process uploaded file if present ────────────────────
    if (file && file.buffer) {
      console.log(`📄 Processing file: ${file.originalname} (${file.size} bytes)`)
      let text: string

      try {
        const result = await extractTextFromFile(
          file.buffer,
          file.originalname,
          file.mimetype
        )
        text = result.text
        console.log(`✅ Step 1 — Text extracted via ${result.method} (${text.length} chars)`)
      } catch (extractionError: unknown) {
        const extractionMessage = extractionError instanceof Error
          ? extractionError.message
          : "Unknown file extraction error"
        console.error("File extraction failed:", extractionMessage)
        const msg  = extractionError instanceof Error ? extractionError.message : ""
        const safe = msg && !/_KEY|SECRET|TOKEN|password|environment variable/i.test(msg)
        return res.status(422).json({
          error: safe ? msg : "We couldn't process this file. Try a different file or a smaller upload.",
        })
      }

      const chunks = await chunkText(text)
      console.log(`✅ Step 2 — ${chunks.length} chunks created`)

      const ts     = Date.now()
      const source = file.originalname

      bm25Chunks = chunks.map((chunkText, i) => ({
        id:   `${userId}-${ts}-${i}`,
        text: chunkText,
      }))

      const embeddedChunks = await embedChunks(chunks)
      console.log("✅ Step 3 — Chunks embedded")

      await storeInPinecone(embeddedChunks, userId, ts, source)
      console.log("✅ Step 4 — Stored in Pinecone")

      const { error: docError } = await supabase
        .from("documents")
        .upsert(
          { user_id: userId, source, uploaded_at: ts },
          { onConflict: "user_id,source" }
        )

      if (docError) {
        console.warn("⚠️  Failed to record document in Supabase:", docError.message)
      } else {
        console.log("✅ Step 4b — Document recorded in Supabase")
      }
    }

    const isRepoQuery = filterSource?.startsWith("github:") ?? false
    const repoName    = isRepoQuery ? filterSource!.replace("github:", "") : undefined
    const isBroadRepoQuery = isRepoQuery && isBroadRepositoryQuery(query)

    let reranked

    if (isBroadRepoQuery) {
      // Broad repo questions need balanced evidence from several parts of the
      // codebase, not a larger pile of results from one similarity search.
      const searchQueries = await generateRepositorySearchQueries(query, repoName!)
      const queryVectors  = await Promise.all(searchQueries.map(embedQuery))
      const resultGroups  = await Promise.all(
        queryVectors.map(vector => searchPinecone(vector, userId, 8, metadataFilter))
      )
      const uniqueChunks = Array.from(
        new Map(resultGroups.flat().map(chunk => [chunk.id, chunk])).values()
      )
      const facetEvidence = selectFacetEvidence(resultGroups)

      console.log(`✅ Step 5 — Multi-query repo retrieval found ${uniqueChunks.length} unique candidates`)
      reranked = await rerankChunks(query, uniqueChunks.map(chunk => chunk.text), 24)

      const rerankedChunks = reranked.map(chunk => chunk.text)
      const balancedChunks = Array.from(new Set([...facetEvidence, ...rerankedChunks]))
      reranked = balancedChunks.map((text, index) => ({
        text,
        relevanceScore: 0,
        originalRank: index + 1,
        newRank: index + 1,
      }))
    } else {
      // Preserve exact code identifiers while adding related implementation terms
      // to improve vector retrieval for focused repository and PDF questions.
      const hypothetical = await generateHypotheticalDocument(query, repoName ? { repository: repoName } : {})
      const retrievalText = isRepoQuery ? `${query}\n\n${hypothetical}` : hypothetical
      const queryVector    = await embedQuery(retrievalText)
      const retrievalTopK  = isRepoQuery ? 12 : 5
      const rerankTopN     = isRepoQuery ? 8 : 5
      const hybridChunks   = await hybridSearch(queryVector, query, bm25Chunks, userId, retrievalTopK, metadataFilter)

      console.log("✅ Step 5 — HyDE generated + embedded")
      reranked = await rerankChunks(query, hybridChunks.map(chunk => chunk.text), rerankTopN)
    }

    const rerankedChunks = reranked.map(c => c.text)
    const relevantChunks = isBroadRepoQuery
      ? selectDiverseRepositoryChunks(rerankedChunks, 20)
      : rerankedChunks
    console.log(`✅ Step 6 — ${relevantChunks.length} chunks reranked and ready`)

    // ── Step 6b — Repo tree injection ──────────────────────
    // If user is querying a specific repo AND query is structural
    // fetch the full tree from Supabase and pass to Groq
    let repoContext: { repoName: string; tree: any[]; broadQuery?: boolean } | undefined

    const isStructural   = isStructuralQuery(query)

    if (isRepoQuery) {
      if (isStructural || isBroadRepoQuery) {
        // Structural query — fetch full tree
        console.log(`🌳 Repository overview requested — fetching tree for ${repoName!}`)

        const { data, error } = await supabase
          .from("repo_trees")
          .select("tree, repo_name")
          .eq("user_id", userId)
          .eq("repo_name", repoName!)
          .single()

        if (!error && data) {
          repoContext = {
            repoName: data.repo_name,
            tree:     data.tree ?? [],
            broadQuery: isBroadRepoQuery,
          }
          console.log(`✅ Tree loaded: ${repoContext.tree.length} files`)
        } else {
          console.warn("⚠️  Could not fetch repo tree:", error?.message)
          repoContext = {
            repoName: repoName!,
            tree: [],
            broadQuery: isBroadRepoQuery,
          }
        }
      } else {
        // Non-structural repo query — still inject repo name so Groq
        // knows which repo is being discussed
        repoContext = {
          repoName: repoName!,
          tree: [],   // empty tree — Groq won't show file list
          broadQuery: isBroadRepoQuery,
        }
      }
    }

    if (relevantChunks.length === 0 && !repoContext) {
      console.log("⚠️  No chunks found — falling back to Groq general knowledge")
    }

    // Step 7 — Conversation history
    let conversationHistory: { role: "user" | "assistant"; content: string }[] = []
    if (chatId) {
      const previousMessages = await getChatMessagesForUser(chatId, userId)
      if (!previousMessages) {
        return res.status(403).json({ error: "This chat does not belong to your account." })
      }
      conversationHistory = previousMessages.flatMap((m: { query: string; answer: string }) => [
        { role: "user"      as const, content: m.query  },
        { role: "assistant" as const, content: m.answer },
      ])
      console.log(`✅ Step 7 — Loaded ${previousMessages.length} previous messages`)
    }

    // Step 8 — Ask Groq (with optional repo context)
    const answer = await askGroq(query, relevantChunks, conversationHistory, repoContext)
    console.log("✅ Step 8 — Answer generated")

    // Step 8b — Evaluate (non-blocking)
    evalRAG(query, relevantChunks, answer).catch(err =>
      console.warn("⚠️  Eval failed silently:", err)
    )

    // Step 9 — Save
    if (!chatId) {
      const newChat = await createChat(userId, query)
      chatId = newChat.id
      console.log("✅ Step 9 — New chat created:", chatId)
    }

    await saveMessage(chatId, userId, query, answer, !!(file && file.buffer))
    console.log("✅ Step 10 — Message saved to Supabase")

    res.json({
      text:   answer,
      chatId: chatId ?? null,
      meta: {
        source:          filterSource ?? "all",
        filter:          metadataFilter ?? null,
        repoTreeInjected: !!repoContext,
        structuralQuery:  isStructural ?? false,
        broadRepoQuery:    isBroadRepoQuery,
      },
    })

  } catch (error: any) {
    console.error("Unhandled error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
}

export default pdf
