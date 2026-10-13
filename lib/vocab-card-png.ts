import { Resvg } from "@resvg/resvg-js"
import { CARD_FONT_FAMILY, getCardFontFiles } from "@/lib/vocab-card-fonts"
import { VOCAB_CARD_W } from "@/lib/vocab-card"
import { renderVocabCardSvg } from "@/lib/vocab-card-svg"
import type { VocabularyItem } from "@/lib/types"

export async function renderVocabCardPng(item: VocabularyItem): Promise<Buffer> {
  const fontFiles = getCardFontFiles()
  const svg = renderVocabCardSvg(item, { fontFamily: CARD_FONT_FAMILY })
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: VOCAB_CARD_W },
    font: {
      fontFiles,
      loadSystemFonts: false,
      defaultFontFamily: CARD_FONT_FAMILY,
      sansSerifFamily: CARD_FONT_FAMILY,
    },
  })
  return Buffer.from(resvg.render().asPng())
}
