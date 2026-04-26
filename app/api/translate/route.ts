import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: Request) {
  try {
    const { word, definition, example_sentence, context, type } = await request.json()

    if (!word) {
      return NextResponse.json({ error: "Word is required" }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    const prompt = `You are a professional English-Korean translator and language teacher.

Translate the following English vocabulary item into Korean and provide a detailed explanation for Korean learners.

Word/Phrase: ${word}
Type: ${type}
English Definition: ${definition || "N/A"}
Example Sentence: ${example_sentence || "N/A"}
Context from transcript: ${context || "N/A"}

Provide the response as valid JSON only (no markdown, no code fences):
{
  "korean_translation": "Korean translation of the word/phrase",
  "korean_definition": "Explanation of the word in Korean, including nuances and usage notes",
  "korean_example": "Korean translation of the example sentence",
  "usage_notes": "Additional usage tips in Korean (when to use it, common mistakes, etc.)"
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

    let translation = {}
    try {
      translation = JSON.parse(cleaned)
    } catch {
      translation = { korean_translation: "번역 실패", korean_definition: "번역을 가져오는 데 실패했습니다." }
    }

    return NextResponse.json(translation)
  } catch (error) {
    console.error("Translate API error:", error)
    return NextResponse.json({ error: "Translation failed" }, { status: 500 })
  }
}
