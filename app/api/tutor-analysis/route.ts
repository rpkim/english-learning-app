import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"
import type { TutorSession } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const sessions: TutorSession[] = Array.isArray(body?.sessions) ? body.sessions : []

    if (sessions.length === 0) {
      return NextResponse.json({ error: "No sessions provided" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 })
    }

    // Build a compact transcript of all user questions
    const userMessages = sessions
      .flatMap((s) => s.messages.filter((m) => m.role === "user").map((m) => m.content.trim()))
      .filter(Boolean)
      .slice(0, 80) // cap to avoid token overflow

    if (userMessages.length === 0) {
      return NextResponse.json({ error: "No user messages found" }, { status: 400 })
    }

    const prompt = `You are an English learning coach analyzing a Korean learner's tutor chat history.

The learner asked the following questions/requests (most recent first):
${userMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}

Based on these, provide a concise learning analysis in Korean with the following sections:

1. **주요 질문 패턴** (2–3문장): 어떤 종류의 질문을 가장 많이 했는지 (뜻 묻기, 번역, 표현 다듬기, 문법 등)

2. **자주 다루는 주제** (bullet 3–5개): 어떤 주제나 상황의 영어가 자주 등장하는지

3. **학습 추천** (bullet 3개): 이 패턴을 바탕으로 집중적으로 공부하면 좋을 구체적인 영역이나 방법

4. **한 줄 요약**: 이 학습자의 현재 영어 학습 스타일을 한 문장으로 표현

짧고 실용적으로 작성해 주세요.`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
    const result = await model.generateContent(prompt)
    const analysis = result.response.text().trim()

    return NextResponse.json({ analysis })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
