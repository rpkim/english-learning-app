import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"

const LANG_MAP: Record<string, string> = { ko: "Korean", en: "English", ja: "Japanese", es: "Spanish" }

export interface NextWordRec {
  word: string
  ko: string
  reason: string
  example?: string
}

interface VocabPayload {
  word: string
  type: string
  korean_translation?: string | null
  definition?: string | null
}

export async function POST(req: NextRequest) {
  const { vocabulary, topics, excludeWords, targetLang } = (await req.json()) as {
    vocabulary?: VocabPayload[]
    topics?: string[]
    excludeWords?: string[]
    targetLang?: string
  }

  const lang = LANG_MAP[targetLang ?? "ko"] ?? "Korean"
  const vocab = vocabulary ?? []
  const exclude = new Set((excludeWords ?? []).map((w) => w.toLowerCase()))
  const topicHint = topics?.length ? topics.join(", ") : ""

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 })
  }

  const vocabSample = vocab.slice(0, 40).map((v) => v.word).join(", ")
  const excludeList = [...exclude].slice(0, 120).join(", ") || "(none)"

  const prompt = `You are an English vocabulary coach. Recommend 5 NEW English words for a Korean learner.

Learner's saved words (sample): ${vocabSample}
${topicHint ? `Focus topics: ${topicHint}` : ""}

NEVER recommend these words (already saved or already suggested):
${excludeList}

Return ONLY valid JSON:
{
  "next_words": [
    { "word": "<English>", "ko": "<meaning in ${lang}>", "reason": "<why useful, in ${lang}>", "example": "<one natural example sentence in English>" }
  ]
}

Rules:
- Exactly 5 words, all different from exclude list
- Similar or slightly higher level than learner's vocabulary
- Mix practical everyday and slightly advanced words
- ko and reason in ${lang}
- example must be a natural English sentence using the word`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  })

  const result = await model.generateContent(prompt)
  const data = JSON.parse(result.response.text()) as { next_words: NextWordRec[] }

  const filtered = (data.next_words ?? []).filter(
    (w) => w.word && !exclude.has(w.word.toLowerCase()),
  )

  return NextResponse.json({ next_words: filtered })
}
