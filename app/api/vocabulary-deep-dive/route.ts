import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"

type DeepDiveMode = "examples" | "etymology" | "both"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const word = typeof body.word === "string" ? body.word.trim() : ""
    const type = typeof body.type === "string" ? body.type : "word"
    const definition = typeof body.definition === "string" ? body.definition : ""
    const example_sentence = typeof body.example_sentence === "string" ? body.example_sentence : ""
    const context = typeof body.context === "string" ? body.context : ""
    const mode = (body.mode === "examples" || body.mode === "etymology" || body.mode === "both" ? body.mode : "both") as DeepDiveMode

    if (!word) {
      return NextResponse.json({ error: "word is required" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY is not configured",
          extra_examples: [] as string[],
          etymology: "",
        },
        { status: 503 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

    const base = `Word/phrase: ${word}
Type: ${type}
Existing definition: ${definition || "N/A"}
Existing example: ${example_sentence || "N/A"}
Transcript context: ${context || "N/A"}`

    let ask = ""
    if (mode === "examples") {
      ask = `${base}

Return valid JSON only (no markdown, no code fences):
{
  "extra_examples": ["3 short lines: English sentence — brief Korean gloss for learners"]
}`
    } else if (mode === "etymology") {
      ask = `${base}

Return valid JSON only (no markdown, no code fences):
{
  "etymology": "2-5 sentences: origin/root, how it relates to modern meaning. For Korean learners, include brief Korean where helpful.",
  "related_forms": "optional related words or collocations, one line or empty string"
}`
    } else {
      ask = `${base}

Return valid JSON only (no markdown, no code fences):
{
  "extra_examples": ["3 short lines: English sentence — brief Korean gloss"],
  "etymology": "2-5 sentences on roots/origin; add short Korean glosses where helpful",
  "related_forms": "one line of related collocations or empty string"
}`
    }

    const result = await model.generateContent(ask)
    const text = result.response.text().trim()
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

    try {
      const parsed = JSON.parse(cleaned) as {
        extra_examples?: unknown
        etymology?: unknown
        related_forms?: unknown
      }
      const extra_examples = Array.isArray(parsed.extra_examples)
        ? parsed.extra_examples.map((x) => String(x ?? "").trim()).filter(Boolean)
        : []
      const etymology = typeof parsed.etymology === "string" ? parsed.etymology.trim() : ""
      const related_forms = typeof parsed.related_forms === "string" ? parsed.related_forms.trim() : ""

      if (mode === "examples") {
        return NextResponse.json({ extra_examples, etymology: "", related_forms: "" })
      }
      if (mode === "etymology") {
        return NextResponse.json({ extra_examples: [] as string[], etymology, related_forms })
      }
      return NextResponse.json({ extra_examples, etymology, related_forms })
    } catch {
      return NextResponse.json({ error: "Model returned invalid JSON", raw: cleaned.slice(0, 500) }, { status: 502 })
    }
  } catch (e) {
    console.error("vocabulary-deep-dive:", e)
    return NextResponse.json({ error: "Deep dive failed" }, { status: 500 })
  }
}
