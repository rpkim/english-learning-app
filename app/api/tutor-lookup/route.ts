import { NextResponse } from "next/server"
import { runTutorLookup, type LookupType } from "@/lib/tutor-lookup"

export type { LookupType, MeaningResult, TranslateResult, NaturalizeResult, LookupResult } from "@/lib/tutor-lookup"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const text = typeof body.text === "string" ? body.text.trim() : ""
    const context = typeof body.context === "string" ? body.context.trim() : ""
    const type = body.type as LookupType
    const localeCode = typeof body.targetLang === "string" ? body.targetLang : "ko"

    if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 })
    if (!["meaning", "translate", "naturalize"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 })
    }

    const data = await runTutorLookup({ text, type, context, targetLang: localeCode })
    return NextResponse.json(data)
  } catch (e) {
    console.error("tutor-lookup:", e)
    const msg = e instanceof Error ? e.message : "Lookup failed"
    const status = msg.includes("GEMINI_API_KEY") ? 503 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
