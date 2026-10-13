import { Resvg } from "@resvg/resvg-js"
import { collectCardText, VOCAB_CARD_W } from "@/lib/vocab-card"
import { loadCardFonts } from "@/lib/vocab-card-fonts"
import { renderVocabCardSvg } from "@/lib/vocab-card-svg"
import type { VocabularyItem } from "@/lib/types"

export async function renderVocabCardPng(item: VocabularyItem): Promise<Buffer> {
  const fonts = await loadCardFonts(collectCardText(item))
  const svg = renderVocabCardSvg(item, { fonts })
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: VOCAB_CARD_W },
    font: {
      loadSystemFonts: false,
      defaultFontFamily: "Noto Sans KR",
    },
  })
  return Buffer.from(resvg.render().asPng())
}
