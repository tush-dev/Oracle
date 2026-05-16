import "dotenv/config";

const VOYAGE_API_KEY = process.env.VOYAGEAI_API_KEY;

export const embedChunks = async (chunks: string[]) => {
  const BATCH_SIZE = 20;
  const allEmbedded: { text: string; vector: number[] }[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: batch,
        model: "voyage-3",
      }),
    });

    const data = (await response.json()) as any;

    if (!data.data) {
      console.error("Voyage error:", data);
      throw new Error("Voyage API failed");
    }

    const batchEmbedded = batch.map((text, j) => ({
      text: text,
      vector: data.data[j].embedding,
    }));

    allEmbedded.push(...batchEmbedded);
    console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} done`);

    // ← add delay between batches for free tier rate limit
    // if (i + BATCH_SIZE < chunks.length) {
    //   console.log("⏳ Waiting 25s for rate limit...");
    //   await new Promise((resolve) => setTimeout(resolve, 25000));
    // }
  }

  console.log(`✅ Total embedded: ${allEmbedded.length} chunks`);
  return allEmbedded;
};

export const embedQuery = async (query: string): Promise<number[]> => {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: [query],
      model: "voyage-3",
    }),
  });

  const data = (await response.json()) as any;

  if (!data.data) {
    console.error("Voyage error:", data);
    throw new Error("Voyage API failed");
  }

  console.log("✅ Query embedded");
  return data.data[0].embedding;
};
