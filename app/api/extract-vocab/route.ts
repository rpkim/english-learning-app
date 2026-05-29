import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"

type VocabType = "word" | "idiom" | "slang" | "phrasal_verb" | "expression"

type ExtractedVocabItem = {
  word: string
  type: VocabType
  definition: string
  example_sentence: string
  korean_translation: string
  context?: string
}

const LANG_MAP: Record<string, string> = {
  ko: "Korean",
  en: "English",
  ja: "Japanese",
  es: "Spanish",
}

function normalizeType(raw: unknown): VocabType {
  const s = typeof raw === "string" ? raw.toLowerCase().replace(/[\s-]+/g, "_") : ""
  if (["word", "idiom", "slang", "phrasal_verb", "expression"].includes(s)) return s as VocabType
  if (s === "phrase" || s === "collocation") return "expression"
  return "word"
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const text = typeof body.text === "string" ? body.text.trim() : ""
    const localeCode = typeof body.targetLang === "string" ? body.targetLang : "ko"
    const lang = LANG_MAP[localeCode] ?? "Korean"

    if (!text || text.length < 3) {
      return NextResponse.json({ items: [] })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 })

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    })

    const prompt = `You are an English vocabulary teacher. Given the following text (which may be a paragraph, sentences, or a list of words — one per line), extract vocabulary items that would be valuable for a language learner.

Text:
${text}

Extract:
- Difficult or advanced words
- Idioms and fixed phrases
- Phrasal verbs
- Slang or colloquial expressions
- Multi-word expressions / collocations

For EACH extracted item return:
- "word": the word or phrase exactly as it appears (or its base form)
- "type": one of "word" | "idiom" | "slang" | "phrasal_verb" | "expression"
- "definition": brief English definition (1 sentence)
- "example_sentence": one natural example sentence using the word
- "korean_translation": the meaning / translation in ${lang} (1-2 sentences)
- "context": the exact sentence from the input where the word appeared (or empty string)

If the input is a plain list of words (one per line), treat each line as a word to look up — extract ALL of them.

Avoid duplicates. Return 3-15 items max (unless the input is a word list, in which case return all).

Return JSON array only. No markdown. Schema:
[{"word":"...","type":"...","definition":"...","example_sentence":"...","korean_translation":"...","context":"..."}]`

    const result = await model.generateContent(prompt)
    const raw = result.response.text()

    let items: ExtractedVocabItem[] = []
    try {
      const parsed = JSON.parse(raw) as unknown
      const arr = Array.isArray(parsed) ? parsed : []
      items = arr
        .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
        .map((i) => ({
          word: String(i.word ?? "").trim(),
          type: normalizeType(i.type),
          definition: String(i.definition ?? "").trim(),
          example_sentence: String(i.example_sentence ?? "").trim(),
          korean_translation: String(i.korean_translation ?? "").trim(),
          context: String(i.context ?? "").trim(),
        }))
        .filter((i) => i.word.length > 0)
    } catch (e) {
      console.error("[extract-vocab] JSON parse failed:", e, raw.slice(0, 300))
    }

    return NextResponse.json({ items })
  } catch (e) {
    console.error("[extract-vocab] error:", e)
    return NextResponse.json({ items: [] }, { status: 500 })
  }
}
