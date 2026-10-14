import { requireV1Auth } from "@/lib/api-v1/guard"
import { errorV1, jsonV1, optionsV1 } from "@/lib/api-v1/http"
import { runTutorLookup, type LookupType } from "@/lib/tutor-lookup"

export const maxDuration = 60

export function OPTIONS() {
  return optionsV1()
}

export async function POST(request: Request) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth
  const body = await request.json().catch(() => ({}))
  const text = typeof body.text === "string" ? body.text.trim() : ""
  const type = body.type as LookupType
  if (!text) return errorV1("text is required", 400)
  if (!["meaning", "translate", "naturalize"].includes(type)) {
    return errorV1("type must be meaning, translate, or naturalize", 400)
  }
  try {
    const data = await runTutorLookup({
      text,
      type,
      context: typeof body.context === "string" ? body.context : undefined,
      targetLang: typeof body.targetLang === "string" ? body.targetLang : "ko",
    })
    return jsonV1(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed"
    return errorV1(msg, msg.includes("GEMINI") ? 503 : 500)
  }
}
