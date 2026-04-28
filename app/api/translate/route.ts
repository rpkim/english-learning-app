import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { word, definition, example_sentence, context, type } = body as {
      word?: string
      definition?: string | null
      example_sentence?: string | null
      context?: string | null
      type?: string | null
    }

    if (!word) {
      return NextResponse.json({ error: "Word is required" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        korean_translation: "",
        korean_definition: "",
        korean_example: "",
        usage_notes: "",
        fallback: true,
        reason_code: "MISSING_GEMINI_API_KEY",
        reason_message: "GEMINI_API_KEY is not configured.",
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

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

    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
      try {
        const parsed = JSON.parse(cleaned)
        return NextResponse.json(parsed)
      } catch {
        return NextResponse.json({
          korean_translation: cleaned || "",
          korean_definition: "",
          korean_example: "",
          usage_notes: "",
          fallback: true,
          reason_code: "MODEL_RETURNED_NON_JSON",
          reason_message: "Gemini response was not valid JSON.",
        })
      }
    } catch (geminiError) {
      console.error("Translate Gemini error:", geminiError)
      return NextResponse.json({
        korean_translation: "",
        korean_definition: "지금은 번역을 사용할 수 없습니다.",
        korean_example: "",
        usage_notes: "잠시 후 다시 시도해 주세요.",
        fallback: true,
        reason_code: "GEMINI_REQUEST_FAILED",
        reason_message: geminiError instanceof Error ? geminiError.message : "Gemini request failed.",
      })
    }
  } catch (error) {
    console.error("Translate API error:", error)
    return NextResponse.json({ error: "Translation failed" }, { status: 500 })
  }
}
