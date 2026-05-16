import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.index("rag-index");

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface PineconeResult {
  id: string
  text: string
  metadata?: Record<string, any>
}

export interface MetadataFilter {
  source?:     string
  uploadedAt?: {
    after?:  number
    before?: number
  }
}

// ─────────────────────────────────────────────────────────────
// STORE — now accepts rich metadata
// ─────────────────────────────────────────────────────────────

export const storeInPinecone = async (
  embeddedChunks: { text: string; vector: number[] }[],
  userId:         string,
  ts:             number = Date.now(),
  source:         string = 'unknown',   // ← filename
) => {
  const vectors = embeddedChunks.map((chunk, i) => ({
    id:     `${userId}-${ts}-${i}`,
    values: chunk.vector,
    metadata: {
      text:        chunk.text,
      userId,
      source,                           // ← filename stored here
      uploadedAt:  ts,                  // ← timestamp stored here
      chunkIndex:  i,                   // ← position in document
      totalChunks: embeddedChunks.length,
    },
  }));

  await index.upsert({ records: vectors });
  console.log(`✅ Stored ${vectors.length} vectors | source: ${source}`);
};

// ─────────────────────────────────────────────────────────────
// BUILD PINECONE FILTER — translates our MetadataFilter to
// Pinecone's filter syntax
// ─────────────────────────────────────────────────────────────

function buildFilter(userId: string, filter?: MetadataFilter) {
  const must: Record<string, any>[] = [
    { userId: { $eq: userId } }         // always filter by user
  ]

  if (filter?.source) {
    must.push({ source: { $eq: filter.source } })
  }

  if (filter?.uploadedAt?.after) {
    must.push({ uploadedAt: { $gte: filter.uploadedAt.after } })
  }

  if (filter?.uploadedAt?.before) {
    must.push({ uploadedAt: { $lte: filter.uploadedAt.before } })
  }

  // If only userId filter → return simple object (your current behavior)
  if (must.length === 1) {
    return { userId: { $eq: userId } }
  }

  // Multiple filters → use $and
  return { $and: must }
}

// ─────────────────────────────────────────────────────────────
// SEARCH — now accepts optional metadata filter
// ─────────────────────────────────────────────────────────────

export const searchPinecone = async (
  queryVector: number[],
  userId:      string,
  topK:        number = 5,
  filter?:     MetadataFilter,        // ← optional, backward compatible
): Promise<PineconeResult[]> => {

  const pineconeFilter = buildFilter(userId, filter)

  console.log('🔎 Pinecone filter:', JSON.stringify(pineconeFilter))

  const results = await index.query({
    vector:          queryVector,
    topK,
    includeMetadata: true,
    filter:          pineconeFilter,
  });

  results.matches?.forEach((m) => {
    console.log(
      `  Score: ${m.score?.toFixed(4)} | source: ${m.metadata?.source} — "${(m.metadata?.text as string)?.slice(0, 50)}..."`,
    );
  });

  const chunks: PineconeResult[] =
    results.matches
      ?.filter((m) => m.metadata?.text)
      .map((m) => ({
        id:       m.id,
        text:     m.metadata!.text as string,
        metadata: m.metadata as Record<string, any>,
      })) ?? [];

  console.log(`✅ Found ${chunks.length} chunks`);
  return chunks;
};