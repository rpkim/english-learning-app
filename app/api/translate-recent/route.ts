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
    let transcript = ""
    try {
      const body = await request.json()
      transcript = typeof body?.transcript === "string" ? body.transcript : ""
    } catch {
      transcript = ""
    }
    const source = extractRecentSentences(transcript)
    if (!source) {
      return NextResponse.json({ source: "", korean_translation: "" })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        source,
        korean_translation: "GEMINI_API_KEY가 없어 자동 번역을 사용할 수 없습니다.",
        fallback: true,
        reason_code: "MISSING_GEMINI_API_KEY",
        reason_message: "GEMINI_API_KEY is not configured.",
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
    const prompt = `Translate the following recent English transcript to natural Korean.

Requirements:
- Keep meaning accurate and concise.
- Return ONLY valid JSON.
- JSON shape:
{"korean_translation":"..."}

Text:
${source}`

    try {
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
    } catch (geminiError) {
      console.error("Translate recent Gemini error:", geminiError)
      const message = geminiError instanceof Error ? geminiError.message : "Gemini request failed."
      const isRateLimited = /\b429\b|resource exhausted|rate limit|too many requests/i.test(message)
      return NextResponse.json({
        source,
        korean_translation: isRateLimited
          ? "번역 요청이 많아 잠시 제한되었습니다. 1분 후 다시 시도해 주세요."
          : "지금은 자동 번역을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        fallback: true,
        reason_code: isRateLimited ? "GEMINI_RATE_LIMITED" : "GEMINI_REQUEST_FAILED",
        reason_message: message,
      })
    }
  } catch (error) {
    console.error("Translate recent API error:", error)
    return NextResponse.json({ error: "Failed to translate recent transcript" }, { status: 500 })
  }
}
