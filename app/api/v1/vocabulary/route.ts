import { requireV1Auth } from "@/lib/api-v1/guard"
import { errorV1, jsonV1, optionsV1 } from "@/lib/api-v1/http"
import { createVocabulary, listVocabulary } from "@/lib/api-v1/store"
import type { VocabularyItem } from "@/lib/types"

export function OPTIONS() {
  return optionsV1()
}

function clampLimit(raw: string | null): number {
  const n = Number(raw ?? 50)
  if (!Number.isFinite(n) || n < 1) return 50
  return Math.min(200, Math.floor(n))
}

export async function GET(request: Request) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth
  const url = new URL(request.url)
  const masteredParam = url.searchParams.get("mastered")
  try {
    const result = await listVocabulary(auth.userId, {
      q: url.searchParams.get("q")?.trim() || undefined,
      collection: url.searchParams.get("collection")?.trim() || undefined,
      type: url.searchParams.get("type")?.trim() || undefined,
      mastered: masteredParam === "true" ? true : masteredParam === "false" ? false : undefined,
      limit: clampLimit(url.searchParams.get("limit")),
      offset: Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0),
    })
    return jsonV1(result)
  } catch (e) {
    return errorV1(e instanceof Error ? e.message : "Failed", 500)
  }
}

export async function POST(request: Request) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth
  const body = await request.json().catch(() => ({}))
  const word = typeof body.word === "string" ? body.word.trim() : ""
  if (!word) return errorV1("word is required", 400)
  try {
    const item = await createVocabulary(auth.userId, body as Partial<VocabularyItem> & { word: string })
    return jsonV1(item, 201)
  } catch (e) {
    return errorV1(e instanceof Error ? e.message : "Failed", 500)
  }
}
