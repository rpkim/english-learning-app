import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

interface BatchItem {
  id: string
  word: string
  type?: string | null
  definition?: string | null
  example_sentence?: string | null
  context?: string | null
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const items: BatchItem[] = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({
        translations: {} as Record<string, string>,
        fallback: true,
        reason_code: "EMPTY_ITEMS",
        reason_message: "No items were provided.",
      })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        translations: {} as Record<string, string>,
        fallback: true,
        reason_code: "MISSING_GEMINI_API_KEY",
        reason_message: "GEMINI_API_KEY is not configured.",
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const trimmed = items.slice(0, 80)
    const payload = trimmed.map((item) => ({
      id: item.id,
      word: item.word,
      type: item.type ?? "word",
      definition: item.definition ?? "",
      example_sentence: item.example_sentence ?? "",
      context: item.context ?? "",
    }))

    const prompt = `You are an English-to-Korean vocabulary translator.
Translate each item to concise, learner-friendly Korean.
Return valid JSON only (no markdown/code fences) with this shape:
{
  "translations": {
    "<id>": "korean translation",
    "<id2>": "korean translation"
  }
}

Items:
${JSON.stringify(payload)}`

    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

      const translations: Record<string, string> = {}
      try {
        const parsed = JSON.parse(cleaned)
        const raw = parsed?.translations
        if (raw && typeof raw === "object") {
          for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
            if (typeof value === "string" && value.trim()) {
              translations[id] = value.trim()
            }
          }
        }
        return NextResponse.json({ translations })
      } catch {
        return NextResponse.json({
          translations,
          fallback: true,
          reason_code: "MODEL_RETURNED_NON_JSON",
          reason_message: "Gemini response was not valid JSON.",
        })
      }
    } catch (geminiError) {
      console.error("Translate batch Gemini error:", geminiError)
      return NextResponse.json({
        translations: {} as Record<string, string>,
        fallback: true,
        reason_code: "GEMINI_REQUEST_FAILED",
        reason_message: geminiError instanceof Error ? geminiError.message : "Gemini request failed.",
      })
    }
  } catch (error) {
    console.error("Translate batch API error:", error)
    return NextResponse.json({ error: "Batch translation failed" }, { status: 500 })
  }
}
