import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

type ChatMsg = { role: "user" | "assistant"; content: string }

function trimContext(s: string, max: number) {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}\n…(truncated)`
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const messages = Array.isArray(body.messages) ? (body.messages as ChatMsg[]) : []
    const transcript_context = typeof body.transcript_context === "string" ? body.transcript_context : ""

    const cleaned = messages
      .filter((m) => m && typeof m.content === "string" && m.content.trim())
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" as const : "user" as const,
        content: m.content.trim(),
      }))

    if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== "user") {
      return NextResponse.json({ error: "Last message must be from user" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured", reply: "" }, { status: 503 })
    }

    const excerpt = trimContext(transcript_context, 10000)
    const system = `You are a friendly English tutor for Korean-speaking learners.
- Answer clearly; give short English examples and Korean glosses when useful.
- If the learner asks about grammar, usage, nuance, or expressions, explain patiently.
- Do not invent facts about their life; stay focused on language learning.
${excerpt ? `\nOptional transcript they are working from (may be partial):\n---\n${excerpt}\n---` : ""}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: system,
    })

    const last = cleaned[cleaned.length - 1]
    const history = cleaned.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(last.content)
    const reply = result.response.text().trim()

    return NextResponse.json({ reply })
  } catch (e) {
    console.error("tutor-chat:", e)
    return NextResponse.json({ error: "Chat failed", reply: "" }, { status: 500 })
  }
}
