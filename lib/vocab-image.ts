import type { VocabularyItem } from "@/lib/types"
import {
  layoutVocabCard,
  vocabImageFilename,
  VOCAB_CARD_H,
  VOCAB_CARD_MARGIN,
  VOCAB_CARD_RADIUS,
  VOCAB_CARD_W,
  type CardRect,
  type CardText,
  type MeasureText,
  type Radius,
  type VocabCardLayout,
} from "@/lib/vocab-card"

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: Radius,
) {
  const [tl, tr, br, bl] = typeof r === "number" ? [r, r, r, r] : r
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  ctx.arcTo(x + w, y, x + w, y + tr, tr)
  ctx.lineTo(x + w, y + h - br)
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br)
  ctx.lineTo(x + bl, y + h)
  ctx.arcTo(x, y + h, x, y + h - bl, bl)
  ctx.lineTo(x, y + tl)
  ctx.arcTo(x, y, x + tl, y, tl)
  ctx.closePath()
}

function fontCss(size: number, weight = "400", style = "") {
  return `${style} ${weight} ${size}px -apple-system, 'Pretendard', 'Noto Sans KR', sans-serif`.trim()
}

function paintRect(ctx: CanvasRenderingContext2D, rect: CardRect) {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.r)
  if (rect.fill) {
    ctx.fillStyle = rect.fill
    ctx.fill()
  }
  if (rect.stroke) {
    ctx.strokeStyle = rect.stroke
    ctx.lineWidth = rect.strokeWidth ?? 1
    ctx.stroke()
  }
}

function paintText(ctx: CanvasRenderingContext2D, line: CardText) {
  ctx.font = fontCss(line.size, line.weight, line.style ?? "")
  ctx.fillStyle = line.color
  ctx.textBaseline = line.baseline
  ctx.textAlign = line.align ?? "left"
  ctx.fillText(line.text, line.x, line.y)
  ctx.textAlign = "left"
}

function paintChrome(ctx: CanvasRenderingContext2D, layout: VocabCardLayout) {
  const p = layout.palette
  const W = VOCAB_CARD_W
  const H = VOCAB_CARD_H
  const MG = VOCAB_CARD_MARGIN
  const cX = MG
  const cY = MG
  const cW = W - MG * 2
  const cH = H - MG * 2

  const bg = ctx.createLinearGradient(0, 0, W * 0.55, H)
  bg.addColorStop(0, p.bg0)
  bg.addColorStop(1, p.bg1)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(W * 0.18, H * 0.16, 0, W * 0.18, H * 0.16, 580)
  glow.addColorStop(0, p.glow)
  glow.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const wash = ctx.createRadialGradient(W * 0.88, H * 0.88, 0, W * 0.88, H * 0.88, 480)
  wash.addColorStop(0, p.glow)
  wash.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.shadowColor = "rgba(15,23,42,0.10)"
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 12
  roundRect(ctx, cX, cY, cW, cH, VOCAB_CARD_RADIUS)
  ctx.fillStyle = p.card
  ctx.fill()
  ctx.restore()

  roundRect(ctx, cX, cY, cW, cH, VOCAB_CARD_RADIUS)
  ctx.strokeStyle = p.border
  ctx.lineWidth = 1.5
  ctx.stroke()

  const accentGrad = ctx.createLinearGradient(cX, 0, cX + cW, 0)
  accentGrad.addColorStop(0, p.accent0)
  accentGrad.addColorStop(0.5, p.accent1)
  accentGrad.addColorStop(1, p.accent2)
  roundRect(ctx, cX, cY, cW, 12, [44, 44, 0, 0])
  ctx.fillStyle = accentGrad
  ctx.fill()
}

function paintLayout(ctx: CanvasRenderingContext2D, layout: VocabCardLayout) {
  const p = layout.palette
  paintRect(ctx, layout.badge.rect)
  paintText(ctx, layout.badge.label)

  for (const line of layout.wordLines) paintText(ctx, line)
  for (const line of layout.koreanLines) paintText(ctx, line)

  const divGrad = ctx.createLinearGradient(layout.dividerX, 0, layout.dividerX + layout.dividerW * 0.72, 0)
  divGrad.addColorStop(0, p.accent0)
  divGrad.addColorStop(0.55, p.accent1)
  divGrad.addColorStop(1, "rgba(255,255,255,0)")
  ctx.globalAlpha = 0.55
  ctx.strokeStyle = divGrad
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(layout.dividerX, layout.dividerY)
  ctx.lineTo(layout.dividerX + layout.dividerW * 0.72, layout.dividerY)
  ctx.stroke()
  ctx.globalAlpha = 1

  for (const section of layout.sections) {
    if (section.box) paintRect(ctx, section.box)
    paintText(ctx, section.label)
    for (const line of section.lines) paintText(ctx, line)
  }

  if (layout.tip) {
    paintText(ctx, layout.tip.label)
    for (const line of layout.tip.lines) paintText(ctx, line)
  }

  paintText(ctx, {
    text: "SurviveEnglish",
    x: VOCAB_CARD_W / 2,
    y: layout.brandY,
    size: 30,
    weight: "700",
    color: p.brand,
    baseline: "middle",
    align: "center",
  })
}

export function downloadVocabImage(item: VocabularyItem): void {
  const canvas = document.createElement("canvas")
  canvas.width = VOCAB_CARD_W
  canvas.height = VOCAB_CARD_H
  const ctx = canvas.getContext("2d")!

  const measure: MeasureText = (text, spec) => {
    ctx.font = fontCss(spec.size, spec.weight, spec.style ?? "")
    return ctx.measureText(text).width
  }
  const layout = layoutVocabCard(item, measure)

  paintChrome(ctx, layout)
  paintLayout(ctx, layout)

  const filename = vocabImageFilename(item.word)

  canvas.toBlob(async (blob) => {
    if (!blob) return

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS && navigator.canShare) {
      const file = new File([blob], filename, { type: "image/png" })
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: item.word })
          return
        } catch {
          // User cancelled share sheet — fall through to regular download
        }
      }
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, "image/png")
}
