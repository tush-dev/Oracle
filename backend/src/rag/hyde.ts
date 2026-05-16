import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!
})

// ─────────────────────────────────────────────────────────────
// GENERATE HYPOTHETICAL DOCUMENT
// ─────────────────────────────────────────────────────────────

export async function generateHypotheticalDocument(
  query: string
): Promise<string> {

  console.log('\n💭 HyDE — Generating hypothetical answer...')

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content:
          `You are a document passage generator.
           Given a question, write a short factual passage (2-4 sentences)
           that would ANSWER this question if it existed in a real document.
           Write it as a statement — not as a question.
           Do NOT say "I think" or "possibly" — write it as if it is fact.
           Keep it under 100 words.`
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: 0.7,   // slight creativity — we want variation not rigidity
    max_tokens:  150,
  })

  const hypothetical = response.choices[0]?.message?.content?.trim() ?? query

  console.log(`  📝 Hypothetical: "${hypothetical.slice(0, 100)}..."`)

  return hypothetical
}