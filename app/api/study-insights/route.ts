import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"
import { GEMINI_MODEL } from "@/lib/storage-config"

const LANG_MAP: Record<string, string> = { ko: "Korean", en: "English", ja: "Japanese", es: "Spanish" }

export interface InsightPattern {
  title: string
  detail: string
}

export interface InsightWeakArea {
  area: string
  evidence: string
  tip: string
}

export interface InsightRecommendation {
  label: string
  description: string
  priority: "high" | "medium" | "low"
}

export interface StudyInsightsResult {
  summary: string
  level_estimate: string
  patterns: InsightPattern[]
  weak_areas: InsightWeakArea[]
  recommendations: InsightRecommendation[]
  word_topics: string[]
  next_words: Array<{ word: string; ko: string; reason: string }>
}

interface VocabPayload {
  word: string
  type: string
  source?: string | null
  collection?: string | null
  is_mastered?: boolean
  korean_translation?: string | null
  definition?: string | null
}

interface TutorQueryPayload {
  type: "meaning" | "translate" | "naturalize"
  query: string
}

export async function POST(req: NextRequest) {
  const { vocabulary, tutorQueries, targetLang } = (await req.json()) as {
    vocabulary?: VocabPayload[]
    tutorQueries?: TutorQueryPayload[]
    targetLang?: string
  }

  const vocab = vocabulary ?? []
  const queries = tutorQueries ?? []
  const lang = LANG_MAP[targetLang ?? "ko"] ?? "Korean"

  if (vocab.length < 3 && queries.length < 2) {
    return NextResponse.json(
      { error: "Need at least 3 saved words or 2 tutor queries to analyze" },
      { status: 400 },
    )
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 })
  }

  const vocabLines = vocab.slice(0, 80).map((v, i) => {
    const tags = [v.type, v.source, v.collection, v.is_mastered ? "mastered" : "learning"].filter(Boolean).join(", ")
    return `${i + 1}. ${v.word} [${tags}] — ${v.korean_translation ?? v.definition ?? ""}`
  }).join("\n") || "(없음)"

  const meaningQs = queries.filter((q) => q.type === "meaning").map((q) => q.query).slice(0, 25)
  const translateQs = queries.filter((q) => q.type === "translate").map((q) => q.query).slice(0, 20)
  const naturalizeQs = queries.filter((q) => q.type === "naturalize").map((q) => q.query).slice(0, 20)

  const prompt = `You are an English learning coach analyzing a Korean learner's study data.

=== Saved vocabulary (${vocab.length} items, showing up to 80) ===
${vocabLines}

=== Tutor "meaning" queries (${meaningQs.length}) ===
${meaningQs.map((q, i) => `${i + 1}. ${q}`).join("\n") || "(없음)"}

=== Tutor "translate" queries (${translateQs.length}) ===
${translateQs.map((q, i) => `${i + 1}. ${q}`).join("\n") || "(없음)"}

=== Tutor "naturalize" queries (${naturalizeQs.length}) ===
${naturalizeQs.map((q, i) => `${i + 1}. ${q}`).join("\n") || "(없음)"}

Analyze patterns across vocabulary AND tutor questions. Return ONLY valid JSON:
{
  "summary": "<2-3 sentences in ${lang} summarizing overall learning style, level, and focus areas>",
  "level_estimate": "<CEFR estimate e.g. B1+ with brief reason in ${lang}>",
  "patterns": [
    { "title": "<short title in ${lang}>", "detail": "<1-2 sentences in ${lang} about a recurring pattern>" }
  ],
  "weak_areas": [
    { "area": "<area name in ${lang}>", "evidence": "<what data shows this in ${lang}>", "tip": "<actionable tip in ${lang}>" }
  ],
  "recommendations": [
    { "label": "<study action in ${lang}>", "description": "<why and how in ${lang}>", "priority": "high|medium|low" }
  ],
  "word_topics": ["<3-6 topic/theme labels in ${lang} e.g. 비즈니스 회화, 감정 표현>"],
  "next_words": [
    { "word": "<English>", "ko": "<${lang} meaning>", "reason": "<why learn this next, in ${lang}>" }
  ]
}

Rules:
- patterns: 3-5 items connecting vocab themes with tutor question habits
- weak_areas: 2-4 specific gaps (not generic)
- recommendations: 3-5 prioritized study actions for THIS learner
- next_words: 4-6 NEW words at similar or slightly higher level; do NOT repeat saved words
- Be specific and evidence-based. All text fields in ${lang} except "word" in next_words.`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  })

  const result = await model.generateContent(prompt)
  const data = JSON.parse(result.response.text()) as StudyInsightsResult
  return NextResponse.json(data)
}
