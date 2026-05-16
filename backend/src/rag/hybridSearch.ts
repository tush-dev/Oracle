import { searchPinecone} from './pinecone.js'
import type { PineconeResult, MetadataFilter } from './pinecone.js'
import { buildBM25Index, searchBM25 } from './bm25.js'
import type  {BM25Chunk, BM25Result}  from './bm25.js'

export interface HybridChunk {
  id: string
  text: string
  score: number
  sources: {
    vector?:  number
    keyword?: number
  }
}

const RRF_K = 60

function applyRRF(
  vectorResults:  PineconeResult[],
  keywordResults: BM25Result[],
  topK:           number
): HybridChunk[] {

  const scoreMap = new Map<string, HybridChunk>()

  vectorResults.forEach((result, index) => {
    const rank = index + 1
    scoreMap.set(result.id, {
      id:      result.id,
      text:    result.text,
      score:   1 / (RRF_K + rank),
      sources: { vector: rank }
    })
  })

  keywordResults.forEach((result, index) => {
    const rank     = index + 1
    const rrfScore = 1 / (RRF_K + rank)
    const existing = scoreMap.get(result.chunk.id)

    if (existing) {
      existing.score          += rrfScore
      existing.sources.keyword = rank
    } else {
      scoreMap.set(result.chunk.id, {
        id:      result.chunk.id,
        text:    result.chunk.text,
        score:   rrfScore,
        sources: { keyword: rank }
      })
    }
  })

  const sorted = Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  console.log('\n🔍 HYBRID SEARCH RESULTS:')
  sorted.forEach(chunk => {
    const v = chunk.sources.vector  ? `vec:#${chunk.sources.vector}`  : 'vec:—'
    const k = chunk.sources.keyword ? `kw:#${chunk.sources.keyword}`  : 'kw:—'
    console.log(`  [${v}] [${k}] score:${chunk.score.toFixed(4)} → ${chunk.text.slice(0, 60)}...`)
  })

  return sorted
}

export async function hybridSearch(
  queryVector: number[],
  queryText:   string,
  allChunks:   BM25Chunk[],
  userId:      string,
  topK:        number = 5,
  filter?:     MetadataFilter,         // ← NEW, optional
): Promise<HybridChunk[]> {

  console.log('\n🔍 Running Hybrid Search...')

  const [vectorResults, bm25Results] = await Promise.all([
    searchPinecone(queryVector, userId, topK, filter),   // ← filter passed here
    Promise.resolve(
      searchBM25(queryText, buildBM25Index(allChunks), topK)
    )
  ])

  console.log(`  Vector hits: ${vectorResults.length} | BM25 hits: ${bm25Results.length}`)

  return applyRRF(vectorResults, bm25Results, topK)
}