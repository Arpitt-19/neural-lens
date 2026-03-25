export async function groqPredict(sentence) {
  const key = import.meta.env.VITE_GROQ_KEY
   console.log("GROQ KEY:", key)   // 👈 add this
  if (!key) return []

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + key
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 150,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: "You are a next-word prediction engine. Given a sentence, return the 8 most likely next words with probabilities. Output ONLY valid JSON array, no explanation, no markdown. Format: [{\"word\":\"Paris\",\"prob\":0.82}]. Probabilities must sum to 1.0. Only real English words. Think carefully about grammar, facts, and long-range context."
            },
            {
              role: "user",
              content: "Sentence: \"" + sentence + "\"\nPredict next 8 words:"
            }
          ]
        })
      }
    )

    if (!response.ok) return []
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content || "[]"
    const clean = text.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)
    const total = parsed.reduce((s, x) => s + (x.prob || 0), 0)
    if (total === 0) return []
    return parsed
      .filter(x => x.word && /^[a-zA-Z]{1,20}$/.test(x.word.trim()))
      .map(x => ({ word: x.word.trim(), prob: x.prob / total }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 8)
  } catch (e) {
    console.error("Groq error:", e)
    return []
  }
}