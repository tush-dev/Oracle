// ============================================================
// BM25 — Keyword Relevance Scoring from Scratch
// ============================================================

const K1 = 1.5
const B  = 0.75

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface BM25Chunk {
  id: string
  text: string
  metadata?: Record<string, any>
}

export interface BM25Result {
  chunk: BM25Chunk
  score: number
  rank: number
}

interface BM25Index {
  chunks: BM25Chunk[]
  tokenizedChunks: string[][]
  chunkLengths: number[]
  avgChunkLength: number
  documentFrequency: Map<string, number>
  N: number
}

// ─────────────────────────────────────────────────────────────
// TOKENIZER
// ─────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(token => token.length > 1)
}

// ─────────────────────────────────────────────────────────────
// BUILD INDEX
// ─────────────────────────────────────────────────────────────

export function buildBM25Index(chunks: BM25Chunk[]): BM25Index {
  const tokenizedChunks = chunks.map(c => tokenize(c.text))
  const chunkLengths    = tokenizedChunks.map(t => t.length)
  const avgChunkLength  = chunkLengths.reduce((a, b) => a + b, 0) / chunks.length

  const documentFrequency = new Map<string, number>()

  for (const tokens of tokenizedChunks) {
    const uniqueTokens = new Set(tokens)
    for (const token of uniqueTokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1)
    }
  }

  return {
    chunks,
    tokenizedChunks,
    chunkLengths,
    avgChunkLength,
    documentFrequency,
    N: chunks.length
  }
}

// ─────────────────────────────────────────────────────────────
// IDF
// ─────────────────────────────────────────────────────────────

function computeIDF(word: string, index: BM25Index): number {
  const n = index.documentFrequency.get(word) ?? 0
  if (n === 0) return 0
  return Math.log((index.N - n + 0.5) / (n + 0.5) + 1)
}

// ─────────────────────────────────────────────────────────────
// SCORE ONE CHUNK
// ─────────────────────────────────────────────────────────────

function scoreChunk(
  chunkIndex: number,
  queryTokens: string[],
  index: BM25Index
): number {
  const tokens   = index.tokenizedChunks[chunkIndex]
  const chunkLen = index.chunkLengths[chunkIndex]
  const avgLen   = index.avgChunkLength

  const termFrequency = new Map<string, number>()

  for (const token of tokens!) {
    termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1)
  }

  let totalScore = 0

  for (const queryToken of queryTokens) {
    const freq = termFrequency.get(queryToken) ?? 0
    if (freq === 0) continue

    const idf         = computeIDF(queryToken, index)
    const numerator   = freq * (K1 + 1)
    const denominator = freq + K1 * (1 - B + B * (chunkLen! / avgLen))
    const tf          = numerator / denominator

    totalScore += idf * tf
  }

  return totalScore
}

// ─────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────

export function searchBM25(
  query: string,
  index: BM25Index,
  topK: number = 5
): BM25Result[] {
  const queryTokens = tokenize(query)

  const scored = index.chunks.map((chunk, i) => ({
    chunk,
    score: scoreChunk(i, queryTokens, index)
  }))

  scored.sort((a, b) => b.score - a.score)

  return scored
    .slice(0, topK)
    .map((result, i) => ({
      ...result,
      rank: i + 1
    }))
}