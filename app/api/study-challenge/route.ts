import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "")

const LANG_MAP: Record<string, string> = { ko: "Korean", en: "English", ja: "Japanese", es: "Spanish" }

export interface ChallengeWord {
  word: string
  type: string
  definition?: string | null
  korean_translation?: string | null
}

export interface ChallengeResult {
  score: number          // 0–10
  used_words: string[]   // which required words were actually used
  missed_words: string[] // required words not found in sentence
  grammar_ok: boolean
  corrections: Array<{ original: string; suggestion: string; reason: string }>
  better_version: string
  praise: string         // positive feedback
  tip: string            // one actionable improvement tip
}

export async function POST(req: NextRequest) {
  const { sentence, words, targetLang } = (await req.json()) as {
    sentence: string
    words: ChallengeWord[]
    targetLang?: string
  }
  const lang = LANG_MAP[targetLang ?? "ko"] ?? "Korean"

  if (!sentence?.trim() || !words?.length) {
    return NextResponse.json({ error: "sentence and words required" }, { status: 400 })
  }

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  })

  const wordList = words.map((w) =>
    `- "${w.word}" (${w.type}): ${w.definition ?? w.korean_translation ?? ""}`
  ).join("\n")

  const prompt = `You are an English writing coach evaluating a learner's sentence. The learner was challenged to write a sentence using specific vocabulary words.

Required vocabulary words:
${wordList}

Learner's sentence:
"${sentence}"

Evaluate the sentence and return JSON with these fields:
- "score": integer 0–10 (10 = perfect: uses all words naturally, grammatically correct, idiomatic)
- "used_words": array of required word strings that were actually and correctly used in the sentence
- "missed_words": array of required words that were missing or incorrectly used
- "grammar_ok": boolean — true if no grammar errors
- "corrections": array of objects { "original": "...", "suggestion": "...", "reason": "..." } — list grammar/usage corrections in ${lang}, empty if none
- "better_version": a polished rewrite that naturally incorporates all required words (keep similar meaning)
- "praise": 1 encouraging sentence in ${lang} about what the learner did well
- "tip": 1 specific, actionable improvement tip in ${lang}

Be encouraging but honest. Return only valid JSON.`

  const result = await model.generateContent(prompt)
  const data = JSON.parse(result.response.text()) as ChallengeResult
  return NextResponse.json(data)
}
