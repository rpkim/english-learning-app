import {
  approxMeasureText,
  layoutVocabCard,
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
import type { VocabularyItem } from "@/lib/types"

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function toRadii(r: Radius): [number, number, number, number] {
  return typeof r === "number" ? [r, r, r, r] : r
}

function roundRectPath(x: number, y: number, w: number, h: number, r: Radius): string {
  const [tl, tr, br, bl] = toRadii(r)
  return [
    `M${x + tl} ${y}`,
    `L${x + w - tr} ${y}`,
    `A${tr} ${tr} 0 0 1 ${x + w} ${y + tr}`,
    `L${x + w} ${y + h - br}`,
    `A${br} ${br} 0 0 1 ${x + w - br} ${y + h}`,
    `L${x + bl} ${y + h}`,
    `A${bl} ${bl} 0 0 1 ${x} ${y + h - bl}`,
    `L${x} ${y + tl}`,
    `A${tl} ${tl} 0 0 1 ${x + tl} ${y}`,
    "Z",
  ].join(" ")
}

function rectEl(rect: CardRect): string {
  const d = roundRectPath(rect.x, rect.y, rect.w, rect.h, rect.r)
  const fill = rect.fill ? ` fill="${rect.fill}"` : ' fill="none"'
  const stroke = rect.stroke
    ? ` stroke="${rect.stroke}" stroke-width="${rect.strokeWidth ?? 1}"`
    : ""
  return `<path d="${d}"${fill}${stroke}/>`
}

function textEl(line: CardText, fontFamily: string): string {
  const baseline = line.baseline === "middle" ? "central" : "hanging"
  const anchor = line.align === "center" ? "middle" : "start"
  const italic = line.style === "italic" ? ' font-style="italic"' : ""
  return (
    `<text xml:space="preserve" x="${line.x}" y="${line.y}" font-size="${line.size}" font-weight="${line.weight}"` +
    `${italic} fill="${line.color}" font-family="${esc(fontFamily)}"` +
    ` dominant-baseline="${baseline}" text-anchor="${anchor}">${esc(line.text)}</text>`
  )
}

function paintContent(layout: VocabCardLayout, fontFamily: string): string {
  const p = layout.palette
  const parts: string[] = [rectEl(layout.badge.rect), textEl(layout.badge.label, fontFamily)]
  for (const line of layout.wordLines) parts.push(textEl(line, fontFamily))
  for (const line of layout.koreanLines) parts.push(textEl(line, fontFamily))
  parts.push(
    `<line x1="${layout.dividerX}" y1="${layout.dividerY}" x2="${layout.dividerX + layout.dividerW * 0.72}" y2="${layout.dividerY}" stroke="url(#se-div)" stroke-width="1.5" opacity="0.55"/>`,
  )
  for (const section of layout.sections) {
    if (section.box) parts.push(rectEl(section.box))
    parts.push(textEl(section.label, fontFamily))
    for (const line of section.lines) parts.push(textEl(line, fontFamily))
  }
  if (layout.tip) {
    parts.push(textEl(layout.tip.label, fontFamily))
    for (const line of layout.tip.lines) parts.push(textEl(line, fontFamily))
  }
  const brandY = layout.brandY
  const brand = "SurviveEnglish"
  const brandW = approxMeasureText(brand, { size: 30, weight: "700" })
  const brandDotX = VOCAB_CARD_W / 2 - brandW / 2 - 18
  parts.push(
    `<circle cx="${brandDotX}" cy="${brandY}" r="6" fill="${p.brandDot}"/>`,
    textEl(
      {
        text: brand,
        x: VOCAB_CARD_W / 2,
        y: brandY,
        size: 30,
        weight: "700",
        color: p.brand,
        baseline: "middle",
        align: "center",
      },
      fontFamily,
    ),
  )
  return parts.join("")
}

export function renderVocabCardSvg(
  item: VocabularyItem,
  opts?: { measure?: MeasureText; fontFamily?: string },
): string {
  const measure = opts?.measure ?? approxMeasureText
  const layout = layoutVocabCard(item, measure)
  const p = layout.palette
  // resvg matches this name against fontFiles; do not list missing fallbacks.
  const fontFamily = opts?.fontFamily ?? "Noto Sans KR"

  const cX = VOCAB_CARD_MARGIN
  const cY = VOCAB_CARD_MARGIN
  const cW = VOCAB_CARD_W - VOCAB_CARD_MARGIN * 2
  const cH = VOCAB_CARD_H - VOCAB_CARD_MARGIN * 2
  const card = roundRectPath(cX, cY, cW, cH, VOCAB_CARD_RADIUS)
  const accent = roundRectPath(cX, cY, cW, 12, [44, 44, 0, 0])

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="${VOCAB_CARD_W}" height="${VOCAB_CARD_H}" viewBox="0 0 ${VOCAB_CARD_W} ${VOCAB_CARD_H}">
  <defs>
    <linearGradient id="se-bg" x1="0" y1="0" x2="0.55" y2="1">
      <stop offset="0" stop-color="${p.bg0}"/>
      <stop offset="1" stop-color="${p.bg1}"/>
    </linearGradient>
    <radialGradient id="se-glow" cx="194" cy="216" r="580" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${p.glow}"/>
      <stop offset="1" stop-color="${p.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="se-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${p.accent0}"/>
      <stop offset="0.5" stop-color="${p.accent1}"/>
      <stop offset="1" stop-color="${p.accent2}"/>
    </linearGradient>
    <linearGradient id="se-div" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${p.accent0}"/>
      <stop offset="0.55" stop-color="${p.accent1}"/>
      <stop offset="1" stop-color="${p.accent1}" stop-opacity="0"/>
    </linearGradient>
    <filter id="se-shadow" x="-25%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#0f172a" flood-opacity="0.10"/>
    </filter>
  </defs>
  <rect width="${VOCAB_CARD_W}" height="${VOCAB_CARD_H}" fill="url(#se-bg)"/>
  <rect width="${VOCAB_CARD_W}" height="${VOCAB_CARD_H}" fill="url(#se-glow)"/>
  <path d="${card}" fill="${p.card}" filter="url(#se-shadow)"/>
  <path d="${card}" fill="none" stroke="${p.border}" stroke-width="1.5"/>
  <path d="${accent}" fill="url(#se-accent)"/>
  ${paintContent(layout, fontFamily)}
</svg>`
}
