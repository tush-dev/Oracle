

const VOYAGE_API_KEY = "pa-oHelEBOTlJvQMMsyJ_6yBuMM53_w5V6CayD6XhtoiZw";

const embedChunks = async (chunks) => {
  console.log("hello from embedChunks");
  const BATCH_SIZE = 20;
  const allEmbedded = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    console.log("hitting voyage api with batch size:", batch.length);

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

    const data = await response.json();
    console.log("Voyage raw response:", JSON.stringify(data).slice(0, 200));

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
  }

  console.log(`✅ Total embedded: ${allEmbedded.length} chunks`);
  return allEmbedded;
};

const embedQuery = async (query) => {
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

  const data = await response.json();

  if (!data.data) {
    console.error("Voyage error:", data);
    throw new Error("Voyage API failed");
  }

  console.log("✅ Query embedded");
  return data.data[0].embedding;
};

// ── TEST ──────────────────────────────────────
async function test() {
  console.log("\n========== TESTING embedChunks ==========");

  const dummyChunks = [
    "RAG stands for Retrieval Augmented Generation.",
    "It helps LLMs access external knowledge.",
    "RAG reduces hallucinations significantly.",
    "Pinecone is a vector database.",
    "Voyage AI provides embedding models.",
  ];

  const embedded = await embedChunks(dummyChunks);

  console.log("\n--- embedChunks Results ---");
  console.log("Total chunks embedded :", embedded.length);
  console.log("First chunk text      :", embedded[0].text);
  console.log("Vector dimensions     :", embedded[0].vector.length);
  console.log("First 5 vector values :", embedded[0].vector.slice(0, 5));

  console.log("\n========== TESTING embedQuery ==========");

  const query = "What is RAG?";
  const vector = await embedQuery(query);

  console.log("\n--- embedQuery Results ---");
  console.log("Query              :", query);
  console.log("Vector dimensions  :", vector.length);
  console.log("First 5 values     :", vector.slice(0, 5));
}

test().catch(console.error);
