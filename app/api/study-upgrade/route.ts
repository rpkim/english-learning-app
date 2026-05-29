import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "")

export interface UpgradeChange {
  from: string
  to: string
  reason: string
}

export interface UpgradeAlternative {
  text: string
  register: string
}

export interface UpgradeResult {
  original: string
  improved: string
  explanation: string
  changes: UpgradeChange[]
  usedVocabWords: string[]
  alternatives: UpgradeAlternative[]
}

const LANG_MAP: Record<string, string> = { ko: "Korean", en: "English", ja: "Japanese", es: "Spanish" }

export async function POST(req: NextRequest) {
  const { sentence, vocabulary, targetLang } = (await req.json()) as {
    sentence: string
    targetLang?: string
    vocabulary: Array<{ word: string; type: string; definition?: string; korean?: string }>
  }
  const lang = LANG_MAP[targetLang ?? "ko"] ?? "Korean"

  if (!sentence?.trim()) {
    return NextResponse.json({ error: "sentence required" }, { status: 400 })
  }

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  })

  const vocabContext =
    vocabulary.length > 0
      ? `\nThe learner has saved these English words/expressions:\n${vocabulary
          .slice(0, 80)
          .map((v) => `- "${v.word}" (${v.type}): ${v.definition ?? ""} [KR: ${v.korean ?? ""}]`)
          .join("\n")}`
      : ""

  const prompt = `You are an English language coach. A learner has written the following sentence or text:

"${sentence}"
${vocabContext}

Your task:
1. Produce one improved version — more natural, fluent, and expressive English. Keep the same meaning.
2. Explain each change concisely in ${lang}.
3. If any of the learner's saved vocab words could replace or enhance their original phrasing, USE them and list the words used.
4. Give 2 alternative versions with different registers (e.g. casual / formal). Label each register in ${lang}.

Return JSON matching this exact schema:
{
  "original": "the input sentence verbatim",
  "improved": "the upgraded English sentence",
  "explanation": "overall explanation in ${lang} (1-2 sentences)",
  "changes": [
    { "from": "original phrase", "to": "improved phrase", "reason": "${lang} reason, ≤20 chars" }
  ],
  "usedVocabWords": ["word1"],
  "alternatives": [
    { "text": "alternative sentence", "register": "<${lang} register label>" },
    { "text": "alternative sentence", "register": "<${lang} register label>" }
  ]
}`

  const result = await model.generateContent(prompt)
  const data = JSON.parse(result.response.text()) as UpgradeResult
  return NextResponse.json(data)
}
