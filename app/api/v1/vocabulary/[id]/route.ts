import { requireV1Auth } from "@/lib/api-v1/guard"
import { errorV1, jsonV1, optionsV1 } from "@/lib/api-v1/http"
import { addUserSentence, deleteVocabulary, getVocabulary, updateVocabulary } from "@/lib/api-v1/store"
import type { VocabularyItem } from "@/lib/types"

export function OPTIONS() {
  return optionsV1()
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth
  const { id } = await ctx.params
  try {
    const item = await getVocabulary(auth.userId, id)
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
  const body = await request.json().catch(() => ({})) as Partial<VocabularyItem> & { add_sentence?: string }
  try {
    if (typeof body.add_sentence === "string" && body.add_sentence.trim()) {
      const item = await addUserSentence(auth.userId, id, body.add_sentence)
      return jsonV1(item)
    }
    const { add_sentence: _a, id: _id, created_at: _c, ...fields } = body
    const item = await updateVocabulary(auth.userId, id, fields)
    return jsonV1(item)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed"
    return errorV1(msg, msg === "not found" ? 404 : 500)
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth
  const { id } = await ctx.params
  try {
    const ok = await deleteVocabulary(auth.userId, id)
    if (!ok) return errorV1("Not found", 404)
    return jsonV1({ ok: true })
  } catch (e) {
    return errorV1(e instanceof Error ? e.message : "Failed", 500)
  }
}
