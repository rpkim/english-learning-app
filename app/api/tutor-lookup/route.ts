import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"

export type LookupType = "meaning" | "translate" | "naturalize"

export interface MeaningResult {
  type: "meaning"
  query: string
  meaning: string
  nuance: string
  register?: string
  examples: { en: string; ko: string }[]
  tips?: string
}

export interface TranslateResult {
  type: "translate"
  query: string
  translation: string
  literal?: string | null
  note?: string | null
}

export interface NaturalizeResult {
  type: "naturalize"
  query: string
  improved: string
  alternatives: { text: string; note: string }[]
  changes: string
}

export type LookupResult = MeaningResult | TranslateResult | NaturalizeResult

const PROMPTS: Record<LookupType, (text: string) => string> = {
  meaning: (text) => `You are an English tutor for Korean learners. Given a word or expression, return a JSON object with exactly these fields:
{
  "query": "<the original word/expression>",
  "meaning": "<concise Korean meaning, 1-2 sentences>",
  "nuance": "<nuance in Korean: context, register, connotation, 2-3 sentences>",
  "register": "<one of: Formal | Neutral | Casual | Slang | Business>",
  "examples": [
    { "en": "<example sentence 1>", "ko": "<Korean translation>" },
    { "en": "<example sentence 2>", "ko": "<Korean translation>" }
  ],
  "tips": "<optional helpful tip in Korean, or null>"
}

Word/expression: "${text}"

Return valid JSON only. No markdown fences.`,

  translate: (text) => `You are an English-to-Korean translator. Given English text, return a JSON object with exactly these fields:
{
  "query": "<original English text>",
  "translation": "<natural Korean translation>",
  "literal": "<literal/word-by-word translation if meaningfully different, otherwise null>",
  "note": "<helpful Korean note about idioms, tone, or context — or null>"
}

Text: "${text}"

Return valid JSON only. No markdown fences.`,

  naturalize: (text) => `You are a native English speaker helping Korean learners sound more natural. Given an English sentence, return a JSON object with exactly these fields:
{
  "query": "<original sentence>",
  "improved": "<most natural-sounding rewrite>",
  "alternatives": [
    { "text": "<alternative 1>", "note": "<Korean explanation of tone/usage>" },
    { "text": "<alternative 2>", "note": "<Korean explanation of tone/usage>" }
  ],
  "changes": "<brief Korean explanation of what changed and why>"
}

Sentence: "${text}"

Return valid JSON only. No markdown fences.`,
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const text = typeof body.text === "string" ? body.text.trim() : ""
    const type = body.type as LookupType

    if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 })
    if (!["meaning", "translate", "naturalize"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 })

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
    const result = await model.generateContent(PROMPTS[type](text))
    const raw = result.response.text().trim()

    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
    const data = JSON.parse(cleaned) as Record<string, unknown>

    return NextResponse.json({ ...data, type })
  } catch (e) {
    console.error("tutor-lookup:", e)
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 })
  }
}
