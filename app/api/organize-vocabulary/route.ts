import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "")

export interface VocabCollection {
  name: string
  emoji: string
  description: string
  /** Word strings (not IDs) — matched client-side */
  words: string[]
}

export interface OrganizeResult {
  collections: VocabCollection[]
}

type InputItem = {
  id: string
  word: string
  type: string
  definition?: string | null
  context?: string | null
  korean_translation?: string | null
}

const LANG_MAP: Record<string, string> = { ko: "Korean", en: "English", ja: "Japanese", es: "Spanish" }

export async function POST(req: NextRequest) {
  const { items, targetLang } = (await req.json()) as { items: InputItem[]; targetLang?: string }
  const lang = LANG_MAP[targetLang ?? "ko"] ?? "Korean"

  if (!items || items.length === 0) {
    return NextResponse.json({ collections: [] })
  }

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  })

  // Use word as identifier — far more reliable than UUID for AI round-trips
  const prompt = `You are an English vocabulary coach. Given a list of saved English vocabulary items, organize them into 3–6 meaningful collections.

Items (use the "word" field to identify each item in your response):
${JSON.stringify(
  items.map((i) => ({
    word: i.word,
    type: i.type,
    definition: i.definition ?? "",
    native: i.korean_translation ?? "",
  })),
  null,
  2
)}

Instructions:
- Analyze the content of the words (topics, difficulty, usage context, register).
- Pick the categorization strategy that fits THESE words best:
  - Difficulty level (beginner/intermediate/advanced — labels in ${lang})
  - Topic cluster (business, emotions, travel, daily life, academia — labels in ${lang})
  - Register (formal/colloquial/idiomatic — labels in ${lang})
  - Combine strategies if it makes sense.
- Give each collection a short name in ${lang} (≤12 chars), a single emoji, and a one-line description in ${lang} (≤25 chars).
- Assign EVERY item to exactly one collection using the exact "word" string. Do NOT miss any word.
- Collections should be roughly balanced in size.

Return ONLY valid JSON:
{
  "collections": [
    {
      "name": "string (${lang}, ≤12 chars)",
      "emoji": "single emoji",
      "description": "string (${lang}, ≤25 chars)",
      "words": ["word1", "word2"]
    }
  ]
}`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  let data: OrganizeResult
  try {
    data = JSON.parse(text) as OrganizeResult
  } catch (parseErr) {
    console.error("[organize-vocabulary] JSON parse failed:", parseErr, "raw:", text.slice(0, 500))
    return NextResponse.json({ error: "AI response parse failed" }, { status: 500 })
  }

  // Normalize all returned words to lowercase for safer matching
  for (const col of data.collections) {
    col.words = (col.words ?? []).map((w) => String(w))
  }

  // Safety: ensure all input words are assigned
  const assignedWords = new Set(data.collections.flatMap((c) => c.words.map((w) => w.toLowerCase())))
  const unassigned = items.filter((i) => !assignedWords.has(i.word.toLowerCase()))
  if (unassigned.length > 0) {
    console.warn("[organize-vocabulary] unassigned words:", unassigned.map((i) => i.word))
    if (data.collections.length > 0) {
      data.collections[0].words.push(...unassigned.map((i) => i.word))
    }
  }

  console.log("[organize-vocabulary] collections:", data.collections.map((c) => ({ name: c.name, count: c.words.length })))

  return NextResponse.json(data)
}
