import { requireV1Auth } from "@/lib/api-v1/guard"
import { errorV1, jsonV1, optionsV1 } from "@/lib/api-v1/http"
import { deleteConversation, getConversation, updateConversation } from "@/lib/api-v1/store"

export function OPTIONS() {
  return optionsV1()
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth
  const { id } = await ctx.params
  try {
    const item = await getConversation(auth.userId, id)
    if (!item) return errorV1("Not found", 404)
    return jsonV1(item)
  } catch (e) {
    return errorV1(e instanceof Error ? e.message : "Failed", 500)
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const fields: { title?: string; transcript?: string; duration_seconds?: number } = {}
  if (typeof body.title === "string") fields.title = body.title
  if (typeof body.transcript === "string") fields.transcript = body.transcript
  if (typeof body.duration_seconds === "number") fields.duration_seconds = body.duration_seconds
  try {
    return jsonV1(await updateConversation(auth.userId, id, fields))
  } catch (e) {
    return errorV1(e instanceof Error ? e.message : "Failed", 500)
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth
  const { id } = await ctx.params
  try {
    const ok = await deleteConversation(auth.userId, id)
    if (!ok) return errorV1("Not found", 404)
    return jsonV1({ ok: true })
  } catch (e) {
    return errorV1(e instanceof Error ? e.message : "Failed", 500)
  }
}
