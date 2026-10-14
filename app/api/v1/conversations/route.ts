import { requireV1Auth } from "@/lib/api-v1/guard"
import { errorV1, jsonV1, optionsV1 } from "@/lib/api-v1/http"
import { createConversation, listConversations } from "@/lib/api-v1/store"

export function OPTIONS() {
  return optionsV1()
}

export async function GET(request: Request) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth
  const url = new URL(request.url)
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50))
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0)
  try {
    return jsonV1(await listConversations(auth.userId, { limit, offset }))
  } catch (e) {
    return errorV1(e instanceof Error ? e.message : "Failed", 500)
  }
}

export async function POST(request: Request) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth
  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === "string" ? body.title.trim() : ""
  if (!title) return errorV1("title is required", 400)
  try {
    const item = await createConversation(auth.userId, {
      title,
      transcript: typeof body.transcript === "string" ? body.transcript : "",
      duration_seconds: Number(body.duration_seconds) || 0,
    })
    return jsonV1(item, 201)
  } catch (e) {
    return errorV1(e instanceof Error ? e.message : "Failed", 500)
  }
}
