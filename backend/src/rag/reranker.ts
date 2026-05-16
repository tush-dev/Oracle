import { CohereClient } from 'cohere-ai'

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY!
})

export interface RerankResult {
  text: string
  relevanceScore: number
  originalRank: number
  newRank: number
}

export async function rerankChunks(
  query: string,
  chunks: string[],
  topN: number = 5
): Promise<RerankResult[]> {

  if (chunks.length === 0) {
    console.log('⚠️  No chunks to rerank — skipping')
    return []
  }

  console.log(`\n🔀 Reranking ${chunks.length} chunks...`)

  const response = await cohere.rerank({
    model:           'rerank-v3.5',
    query:           query,
    documents:       chunks,
    topN:            topN,
    returnDocuments: true,
  })

  const results: RerankResult[] = response.results.map((r, newIndex) => ({
    text:           r.document?.text ?? chunks[r.index] ?? '',   // ← fix here
    relevanceScore: r.relevanceScore,
    originalRank:   r.index + 1,
    newRank:        newIndex + 1,
  }))

  console.log('\n📊 RERANK RESULTS:')
  results.forEach(r => {
    const moved = r.originalRank - r.newRank
    const arrow = moved > 0 ? `⬆️ +${moved}` : moved < 0 ? `⬇️ ${moved}` : `➡️  0`
    console.log(
      `  [${arrow}] score:${r.relevanceScore.toFixed(4)} | ` +
      `was:#${r.originalRank} now:#${r.newRank} | ` +
      `"${r.text.slice(0, 55)}..."`
    )
  })

  return results
}