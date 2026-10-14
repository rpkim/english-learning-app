import { requireV1Auth } from "@/lib/api-v1/guard"
import { errorV1, optionsV1, pngV1 } from "@/lib/api-v1/http"
import { getVocabulary } from "@/lib/api-v1/store"
import { renderVocabCardPng } from "@/lib/vocab-card-png"
import { vocabImageFilename } from "@/lib/vocab-card"

export const runtime = "nodejs"
export const maxDuration = 30

export function OPTIONS() {
  return optionsV1()
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const format = url.searchParams.get("format")
  if (format && format !== "png") {
    return errorV1("Only format=png is supported", 400)
  }

  const { id } = await ctx.params
  try {
    const item = await getVocabulary(auth.userId, id)
    if (!item) return errorV1("Not found", 404)
    const png = await renderVocabCardPng(item)
    return pngV1(new Uint8Array(png), vocabImageFilename(item.word))
  } catch (e) {
    return errorV1(e instanceof Error ? e.message : "Failed", 500)
  }
}
