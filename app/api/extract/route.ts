import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

type ExtractedItem = {
  word: string
  type: "word" | "idiom" | "phrasal_verb" | "expression"
  definition: string
  example_sentence: string
  context: string
}

function fallbackExtract(transcript: string): ExtractedItem[] {
  const lower = transcript.toLowerCase()
  const items: ExtractedItem[] = []
  const seen = new Set<string>()

  const seedPhrases: Array<{ phrase: string; type: ExtractedItem["type"]; definition: string }> = [
    { phrase: "a little bit of", type: "expression", definition: "a small amount of something" },
    { phrase: "kind of", type: "expression", definition: "to some degree; somewhat" },
    { phrase: "sort of", type: "expression", definition: "approximately; in a way" },
    { phrase: "going to", type: "expression", definition: "used to express future intention" },
    { phrase: "look into", type: "phrasal_verb", definition: "to investigate or examine" },
    { phrase: "find out", type: "phrasal_verb", definition: "to discover information" },
    { phrase: "come up with", type: "phrasal_verb", definition: "to think of an idea or plan" },
    { phrase: "at the end of the day", type: "idiom", definition: "when everything is considered" },
  ]

  for (const seed of seedPhrases) {
    if (lower.includes(seed.phrase) && !seen.has(seed.phrase)) {
      seen.add(seed.phrase)
      items.push({
        word: seed.phrase,
        type: seed.type,
        definition: seed.definition,
        example_sentence: `Try using "${seed.phrase}" in your own sentence.`,
        context: seed.phrase,
      })
    }
  }

  // Add a few longer words as vocabulary candidates.
  const words = transcript.match(/\b[a-zA-Z]{7,}\b/g) ?? []
  for (const w of words) {
    const word = w.toLowerCase()
    if (seen.has(word)) continue
    seen.add(word)
    items.push({
      word,
      type: "word",
      definition: "A vocabulary word extracted from the transcript.",
      example_sentence: `The word "${word}" appears in the transcript.`,
      context: word,
    })
    if (items.length >= 12) break
  }

  return items.slice(0, 12)
}

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json()

    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json({ items: [] })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      // No Gemini key configured: return local fallback extraction instead of failing.
      return NextResponse.json({ items: fallbackExtract(transcript), source: "fallback_no_api_key" })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    const prompt = `You are an English language teacher. Analyze the following English transcript and extract vocabulary items that would be useful for an English learner.

Extract:
1. Difficult or advanced words
2. Idioms (e.g. "kick the bucket", "on the fence")
3. Phrasal verbs (e.g. "give up", "look into")
4. Common expressions and collocations

For each item, provide:
- word: the word, idiom, or phrase exactly as used
- type: one of "word", "idiom", "phrasal_verb", "expression"
- definition: clear English definition
- example_sentence: an example sentence using this item
- context: the exact sentence from the transcript where it appeared (or nearest context)

Return ONLY a valid JSON array with no markdown, no code fences, no extra text. Example format:
[{"word":"kick the bucket","type":"idiom","definition":"to die","example_sentence":"He finally kicked the bucket after a long illness.","context":"..."}]

Transcript:
${transcript}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

    let items = []
    try {
      items = JSON.parse(cleaned)
    } catch {
      items = []
    }

    return NextResponse.json({ items })
  } catch (error) {
    console.error("Extract API error:", error)
    // Keep the learning flow alive even when Gemini request/parsing fails.
    try {
      const body = await request.clone().json()
      const transcript = typeof body?.transcript === "string" ? body.transcript : ""
      return NextResponse.json({ items: fallbackExtract(transcript), source: "fallback_on_error" })
    } catch {
      return NextResponse.json({ items: [], source: "fallback_empty_on_error" })
    }
  }
}
