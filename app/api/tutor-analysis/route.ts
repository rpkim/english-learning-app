import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"
import type { TutorSession } from "@/lib/types"

// ── Types returned to the client ──────────────────────────────────────────

export interface WordRec {
  word: string
  ko: string
  level: string
  reason: string
}

export interface SentenceRec {
  en: string
  ko_hint: string
  level: string
}

export interface GrammarRec {
  area: string
  tip: string
}

export interface AnalysisSection<T> {
  count: number          // how many sessions of this type
  insight: string        // short Korean insight sentence
  items: T[]
}

export interface TutorAnalysisResult {
  meaning:    AnalysisSection<WordRec>
  translate:  AnalysisSection<SentenceRec>
  naturalize: AnalysisSection<GrammarRec>
}

// ── Route ──────────────────────────────────────────────────────────────────

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

    // ── Classify each session by lookup type ──────────────────────────────
    const byType: Record<"meaning" | "translate" | "naturalize", string[]> = {
      meaning: [],
      translate: [],
      naturalize: [],
    }

    for (const session of sessions) {
      // The assistant's first message is JSON.stringify(LookupResult) which has a `type` field
      const assistantMsg = session.messages.find((m) => m.role === "assistant")
      let lookupType: "meaning" | "translate" | "naturalize" | null = null
      if (assistantMsg) {
        try {
          const parsed = JSON.parse(assistantMsg.content) as { type?: string }
          if (parsed.type === "meaning" || parsed.type === "translate" || parsed.type === "naturalize") {
            lookupType = parsed.type
          }
        } catch {
          // assistant content is plain text — try to infer from user message
        }
      }
      // Fallback: derive from title/first user message
      if (!lookupType) {
        const title = session.title.toLowerCase()
        if (title.includes("번역") || title.includes("translate")) lookupType = "translate"
        else if (title.includes("자연") || title.includes("natural")) lookupType = "naturalize"
        else lookupType = "meaning"
      }

      const userQuery = session.messages.find((m) => m.role === "user")?.content.trim() ?? ""
      if (userQuery) byType[lookupType].push(userQuery)
    }

    // ── Build prompt ──────────────────────────────────────────────────────
    const meaningList  = byType.meaning.slice(0, 30).map((q, i) => `${i + 1}. ${q}`).join("\n") || "(없음)"
    const translateList = byType.translate.slice(0, 20).map((q, i) => `${i + 1}. ${q}`).join("\n") || "(없음)"
    const naturalizeList = byType.naturalize.slice(0, 20).map((q, i) => `${i + 1}. ${q}`).join("\n") || "(없음)"

    const prompt = `You are an English learning coach. Analyze a Korean learner's tutor history and return ONLY a JSON object (no markdown fences).

=== 뜻이 뭐야? (단어/표현 의미 검색) ===
${meaningList}

=== 번역해줘 (문장 번역 요청) ===
${translateList}

=== 더 자연스럽게 (표현 교정 요청) ===
${naturalizeList}

Return this exact JSON structure:
{
  "meaning": {
    "count": <number of items in the meaning list>,
    "insight": "<Korean: 1–2 sentence insight about vocabulary level/topics>",
    "items": [
      { "word": "<English word>", "ko": "<Korean meaning>", "level": "<A2|B1|B2|C1>", "reason": "<Korean: why this word is good to learn next>" }
    ]
  },
  "translate": {
    "count": <number of items in the translate list>,
    "insight": "<Korean: insight about translation patterns>",
    "items": [
      { "en": "<English practice sentence>", "ko_hint": "<Korean translation hint>", "level": "<A2|B1|B2|C1>" }
    ]
  },
  "naturalize": {
    "count": <number of items in the naturalize list>,
    "insight": "<Korean: insight about recurring grammar/expression issues>",
    "items": [
      { "area": "<Korean grammar/expression area>", "tip": "<Korean practical improvement tip>" }
    ]
  }
}

Rules:
- For meaning.items: recommend 4–6 NEW words/expressions at a SIMILAR or SLIGHTLY higher level to what was searched. Do not repeat searched words.
- For translate.items: provide 4–5 NEW practice sentences at similar complexity to the translated ones. Include natural, useful everyday sentences.
- For naturalize.items: list 3–5 specific grammar/expression patterns that the learner should focus on based on the errors in their correction requests. Be specific (e.g. "관사 the 사용" not just "문법").
- If a section has "(없음)" data, return count: 0, empty items array, and insight saying "아직 해당 기록이 없습니다."
- All insight and tip fields must be in Korean. word/en/area fields may be English.
- Output ONLY the JSON object, no explanation.`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    })
    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()

    let analysis: TutorAnalysisResult
    try {
      analysis = JSON.parse(raw) as TutorAnalysisResult
    } catch {
      return NextResponse.json({ error: "AI 응답을 파싱할 수 없습니다." }, { status: 500 })
    }

    // Ensure counts reflect actual session data
    analysis.meaning.count = byType.meaning.length
    analysis.translate.count = byType.translate.length
    analysis.naturalize.count = byType.naturalize.length

    return NextResponse.json(analysis)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
