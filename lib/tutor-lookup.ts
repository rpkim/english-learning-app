import { GoogleGenerativeAI } from "@google/generative-ai"
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

function contextBlock(context?: string): string {
  const c = context?.trim()
  if (!c) return ""
  return `

Learner-provided context (use this to disambiguate meaning, pick the right sense/tone, and tailor examples):
"${c.replace(/"/g, "'")}"`
}

function buildPrompts(lang: string): Record<LookupType, (text: string, context?: string) => string> {
  return {
    meaning: (text, context) => `You are an English tutor. Given a word or expression, return a JSON object explaining it in ${lang}.
{
  "query": "<the original word/expression>",
  "meaning": "<concise meaning in ${lang}, 1-2 sentences>",
  "nuance": "<nuance in ${lang}: context, register, connotation, 2-3 sentences>",
  "register": "<one of: Formal | Neutral | Casual | Slang | Business>",
  "examples": [
    { "en": "<example sentence 1>", "ko": "<${lang} translation>" },
    { "en": "<example sentence 2>", "ko": "<${lang} translation>" }
  ],
  "tips": "<optional helpful tip in ${lang}, or null>"
}

Word/expression: "${text}"${contextBlock(context)}

If context is provided, explain the sense that fits that situation first, and make examples match it.

Return valid JSON only. No markdown fences.`,

    translate: (text, context) => `You are an English-to-${lang} translator. Given English text, return a JSON object with exactly these fields:
{
  "query": "<original English text>",
  "translation": "<natural ${lang} translation>",
  "literal": "<literal/word-by-word translation if meaningfully different, otherwise null>",
  "note": "<helpful ${lang} note about idioms, tone, or context — or null>"
}

Text: "${text}"${contextBlock(context)}

If context is provided, choose the translation that fits that situation.

Return valid JSON only. No markdown fences.`,

    naturalize: (text, context) => `You are a native English speaker helping learners sound more natural. Given an English sentence, return a JSON object with exactly these fields:
{
  "query": "<original sentence>",
  "improved": "<most natural-sounding rewrite>",
  "alternatives": [
    { "text": "<alternative 1>", "note": "<${lang} explanation of tone/usage>" },
    { "text": "<alternative 2>", "note": "<${lang} explanation of tone/usage>" }
  ],
  "changes": "<brief ${lang} explanation of what changed and why>"
}

Sentence: "${text}"${contextBlock(context)}

If context is provided, rewrite for that situation (audience, formality, setting).

Return valid JSON only. No markdown fences.`,
  }
}

const LANG_MAP: Record<string, string> = {
  ko: "Korean",
  en: "English",
  ja: "Japanese",
  es: "Spanish",
}

export async function runTutorLookup(input: {
  text: string
  type: LookupType
  context?: string
  targetLang?: string
}): Promise<LookupResult> {
  const text = input.text.trim()
  const context = input.context?.trim() ?? ""
  const type = input.type
  const lang = LANG_MAP[input.targetLang ?? "ko"] ?? "Korean"
  if (!text) throw new Error("text is required")
  if (!["meaning", "translate", "naturalize"].includes(type)) {
    throw new Error("type must be meaning, translate, or naturalize")
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured")

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
  const prompts = buildPrompts(lang)
  const result = await model.generateContent(prompts[type](text, context || undefined))
  const raw = result.response.text().trim()
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
  const data = JSON.parse(cleaned) as Record<string, unknown>
  return { ...data, type } as LookupResult
}
