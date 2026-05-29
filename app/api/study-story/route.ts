import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "")

export interface StoryParagraph {
  en: string
  ko: string
}

export interface StoryResult {
  title: string
  titleKo: string
  paragraphs: StoryParagraph[]
  usedWords: string[]
}

const LANG_MAP: Record<string, string> = { ko: "Korean", en: "English", ja: "Japanese", es: "Spanish" }

export async function POST(req: NextRequest) {
  const { words, length = "medium", targetLang } = (await req.json()) as {
    words: Array<{ word: string; type: string; korean?: string }>
    length?: "short" | "medium" | "long"
    targetLang?: string
  }
  const lang = LANG_MAP[targetLang ?? "ko"] ?? "Korean"

  if (!words || words.length === 0) {
    return NextResponse.json({ error: "words required" }, { status: 400 })
  }

  const paragraphCount = length === "short" ? 2 : length === "long" ? 5 : 3

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  })

  const prompt = `You are a creative English writing coach. Create a short, engaging story that naturally incorporates the vocabulary words below.

Words to use:
${words.map((w) => `- "${w.word}" (${w.type}${w.korean ? `, native: ${w.korean}` : ""})`).join("\n")}

Requirements:
- Write exactly ${paragraphCount} paragraphs of 2–4 sentences each.
- Use as many of the provided words as naturally possible — try to use ALL of them.
- The story should be interesting and coherent, not forced.
- Match English level to the vocabulary complexity.
- For each paragraph, also provide a ${lang} translation.
- List which vocabulary words were successfully used.

Return JSON:
{
  "title": "English story title",
  "titleKo": "${lang} translation of title",
  "paragraphs": [
    { "en": "English paragraph text", "ko": "${lang} translation" }
  ],
  "usedWords": ["word1", "word2"]
}`

  const result = await model.generateContent(prompt)
  const data = JSON.parse(result.response.text()) as StoryResult
  return NextResponse.json(data)
}
