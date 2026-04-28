import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

type DiarizedItem = { text: string; speaker: "A" | "B" }

function splitSentences(transcript: string) {
  return transcript
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function fallbackDiarize(transcript: string): DiarizedItem[] {
  const sentences = splitSentences(transcript)
  const backchannels = /^(yes|yeah|yep|no|nope|right|okay|ok|uh-huh|hmm|mm-hmm)\b/i
  const items: DiarizedItem[] = []
  let current: "A" | "B" = "A"
  let previousEndedWithQuestion = false
  for (const text of sentences) {
    const short = text.split(/\s+/).length <= 4
    if (previousEndedWithQuestion || (short && backchannels.test(text))) {
      current = current === "A" ? "B" : "A"
    }
    items.push({ text, speaker: current })
    previousEndedWithQuestion = text.endsWith("?")
  }
  return items
}

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json()
    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ items: [] as DiarizedItem[] })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ items: fallbackDiarize(transcript), source: "fallback_no_api_key" })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
    const prompt = `You are a dialogue segmentation assistant.
Given this transcript, split it into utterances and assign each utterance to speaker "A" or "B".
Use context to keep turns coherent.
Rules:
- Alternate only when context suggests turn-taking, not strictly every sentence.
- After a question, next utterance is likely from the other speaker.
- Backchannels (yes/yeah/right/okay/no/uh-huh) are usually replies from the other speaker.
- Keep consecutive sentences together when they sound like one continuous turn.

Return ONLY valid JSON array. Format:
[{"text":"...","speaker":"A"},{"text":"...","speaker":"B"}]

Transcript:
${transcript}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

    let parsed: unknown = []
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ items: fallbackDiarize(transcript), source: "fallback_parse_error" })
    }

    const items = Array.isArray(parsed)
      ? parsed
          .map((item) => {
            if (!item || typeof item !== "object") return null
            const text = typeof (item as Record<string, unknown>).text === "string" ? (item as Record<string, string>).text.trim() : ""
            const speakerRaw = (item as Record<string, unknown>).speaker
            const speaker = speakerRaw === "B" ? "B" : "A"
            if (!text) return null
            return { text, speaker } as DiarizedItem
          })
          .filter((v): v is DiarizedItem => Boolean(v))
      : []

    if (items.length === 0) {
      return NextResponse.json({ items: fallbackDiarize(transcript), source: "fallback_empty" })
    }
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] as DiarizedItem[] }, { status: 200 })
  }
}
