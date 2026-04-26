import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json()

    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json({ items: [] })
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    const prompt = `You are an English language teacher. Analyze the following English transcript and extract vocabulary items that would be useful for an English learner.

Extract:
1. Difficult or advanced words
2. Idioms (e.g. "kick the bucket", "on the fence")
3. Phrasal verbs (e.g. "give up", "look into")
4. Common expressions and collocations

For each item, provide:
- word: the word, idiom, or phrase exactly as used
- type: one of "word", "idiom", "phrasal_verb", "expression"
- definition: clear English definition
- example_sentence: an example sentence using this item
- context: the exact sentence from the transcript where it appeared (or nearest context)

Return ONLY a valid JSON array with no markdown, no code fences, no extra text. Example format:
[{"word":"kick the bucket","type":"idiom","definition":"to die","example_sentence":"He finally kicked the bucket after a long illness.","context":"..."}]

Transcript:
${transcript}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

    let items = []
    try {
      items = JSON.parse(cleaned)
    } catch {
      items = []
    }

    return NextResponse.json({ items })
  } catch (error) {
    console.error("Extract API error:", error)
    return NextResponse.json({ error: "Failed to extract vocabulary" }, { status: 500 })
  }
}
