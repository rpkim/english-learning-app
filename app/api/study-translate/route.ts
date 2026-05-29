import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "")
const LANG_MAP: Record<string, string> = { ko: "Korean", en: "English", ja: "Japanese", es: "Spanish" }

export interface TranslateCorrection {
  original: string      // user's phrase
  suggestion: string    // corrected phrase
  reason: string        // why, in targetLang
}

export interface TranslateAlternative {
  text: string
  note: string   // register / nuance note, in targetLang
}

export interface TranslateResult {
  score: number                        // 0–10 (10 = native-level)
  meaning_ok: boolean                  // did meaning transfer correctly?
  meaning_note: string | null          // if false, what was lost/wrong, in targetLang
  corrections: TranslateCorrection[]   // grammar / word choice fixes
  better_version: string               // polished English
  explanation: string                  // overall feedback in targetLang
  alternatives: TranslateAlternative[] // 2 other ways to express the same idea
  vocab_tips: string[]                 // suggest saved vocab words that fit, by word string
}

export async function POST(req: NextRequest) {
  const { korean, english, vocabulary, targetLang } = (await req.json()) as {
    korean: string
    english: string
    vocabulary?: Array<{ word: string; type: string; definition?: string | null }>
    targetLang?: string
  }

  if (!korean?.trim() || !english?.trim()) {
    return NextResponse.json({ error: "korean and english are required" }, { status: 400 })
  }

  const lang = LANG_MAP[targetLang ?? "ko"] ?? "Korean"

  const vocabHint = vocabulary?.length
    ? `\n\nThe learner's saved vocabulary (word — meaning):\n${vocabulary.slice(0, 40).map((v) => `- ${v.word}: ${v.definition ?? ""}`).join("\n")}`
    : ""

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  })

  const prompt = `You are an expert English writing coach helping a Korean learner practice translation.

Korean source text (what the learner wants to express):
"${korean}"

Learner's English attempt:
"${english}"
${vocabHint}

Evaluate the attempt and return JSON with exactly these fields:
- "score": integer 0–10 (10 = perfect natural English with correct meaning)
- "meaning_ok": boolean — true if the core meaning of the Korean was correctly expressed
- "meaning_note": string or null — if meaning_ok is false, briefly explain what was lost or mistranslated in ${lang}; otherwise null
- "corrections": array of objects { "original": "...", "suggestion": "...", "reason": "..." } — specific phrases to fix, with reasons in ${lang}; empty array if none
- "better_version": a polished, natural English sentence/paragraph that best expresses the Korean source
- "explanation": 2–3 sentences of overall constructive feedback in ${lang}, pointing out the learner's strengths and key improvement areas
- "alternatives": array of 2 objects { "text": "...", "note": "..." } — alternative phrasings with different registers or styles (e.g. formal, casual), with notes in ${lang}
- "vocab_tips": array of word strings from the learner's saved vocabulary that would fit well in this context (up to 3); empty array if none match

Be encouraging and specific. Return only valid JSON.`

  const result = await model.generateContent(prompt)
  const data = JSON.parse(result.response.text()) as TranslateResult
  return NextResponse.json(data)
}
