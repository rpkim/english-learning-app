import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

function extractRecentSentences(text: string, maxSentences = 3) {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (!cleaned) return ""
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  return parts.slice(-maxSentences).join(" ").trim()
}

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json()
    const source = extractRecentSentences(typeof transcript === "string" ? transcript : "")
    if (!source) {
      return NextResponse.json({ source: "", korean_translation: "" })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        source,
        korean_translation: "GEMINI_API_KEY가 없어 자동 번역을 사용할 수 없습니다.",
        fallback: true,
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
    const prompt = `Translate the following recent English transcript to natural Korean.

Requirements:
- Keep meaning accurate and concise.
- Return ONLY valid JSON.
- JSON shape:
{"korean_translation":"..."}

Text:
${source}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
    let korean = ""
    try {
      const parsed = JSON.parse(cleaned)
      korean = typeof parsed?.korean_translation === "string" ? parsed.korean_translation.trim() : ""
    } catch {
      korean = cleaned
    }

    return NextResponse.json({ source, korean_translation: korean })
  } catch (error) {
    console.error("Translate recent API error:", error)
    return NextResponse.json({ error: "Failed to translate recent transcript" }, { status: 500 })
  }
}
