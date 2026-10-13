import type { VocabularyItem } from "@/lib/types"

export const VOCAB_CARD_W = 1080
export const VOCAB_CARD_H = 1350
export const VOCAB_CARD_MARGIN = 64
export const VOCAB_CARD_PAD = 84
export const VOCAB_CARD_RADIUS = 44

export const TYPE_LABELS: Record<string, string> = {
  word: "Word",
  idiom: "Idiom",
  slang: "Slang",
  phrasal_verb: "Phrasal",
  expression: "Expression",
}

export function getKorean(raw: unknown): string {
  if (typeof raw === "string") return raw
  if (!raw || typeof raw !== "object") return ""
  const obj = raw as Record<string, unknown>
  return (
    (typeof obj.korean_translation === "string" ? obj.korean_translation : "") ||
    (typeof obj.meaning === "string" ? obj.meaning : "") ||
    (typeof obj.usage === "string" ? obj.usage : "")
  )
}

export function vocabImageFilename(word: string): string {
  const stem = word.replace(/[^a-zA-Z0-9가-힣\-_]/g, "-")
  return `${stem || "vocabulary"}.png`
}

export function wordFontSize(word: string): number {
  const wordLen = word.length
  return wordLen > 18 ? 68 : wordLen > 12 ? 82 : wordLen > 8 ? 92 : 104
}

export function koreanFontSize(korean: string): number {
  return korean.length > 24 ? 34 : 40
}

export type FontSpec = {
  size: number
  weight: string
  style?: string
}

export type MeasureText = (text: string, spec: FontSpec) => number

export function wrapLines(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
  maxLines = 99,
): string[] {
  const paragraphs = text.split("\n")
  const lines: string[] = []
  for (const para of paragraphs) {
    if (lines.length >= maxLines) break
    const words = para.split(" ")
    let current = ""
    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      if (measure(test) > maxWidth && current) {
        lines.push(current)
        current = word
        if (lines.length >= maxLines) break
      } else {
        current = test
      }
    }
    if (current && lines.length < maxLines) lines.push(current)
  }
  return lines
}

/** Server-safe width estimate when Canvas `measureText` is unavailable. */
export function approxMeasureText(text: string, spec: FontSpec): number {
  const weight = Number(spec.weight) || 400
  const bold = weight >= 600
  let w = 0
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0
    if (ch === " ") w += spec.size * 0.3
    else if (c <= 0x7f) {
      if (/[iIlj\.,:'\|!]/.test(ch)) w += spec.size * 0.28
      else if (/[mwWM@]/.test(ch)) w += spec.size * (bold ? 0.95 : 0.85)
      else w += spec.size * (bold ? 0.65 : 0.56)
    } else if (
      (c >= 0x1100 && c <= 0x11ff) ||
      (c >= 0x3130 && c <= 0x318f) ||
      (c >= 0xac00 && c <= 0xd7af) ||
      (c >= 0x4e00 && c <= 0x9fff)
    ) {
      w += spec.size
    } else {
      w += spec.size * 0.85
    }
  }
  if (spec.style === "italic") w *= 1.02
  return w
}

export type Radius = number | [number, number, number, number]

export type CardRect = {
  x: number
  y: number
  w: number
  h: number
  r: Radius
  fill?: string
  stroke?: string
  strokeWidth?: number
}

export type CardText = {
  text: string
  x: number
  y: number
  size: number
  weight: string
  style?: string
  color: string
  baseline: "top" | "middle"
  align?: "left" | "center"
}

export type CardSection = {
  label: CardText
  lines: CardText[]
  box?: CardRect
}

export type VocabCardLayout = {
  korean: string
  typeLabel: string
  word: string
  badge: { rect: CardRect; label: CardText }
  wordLines: CardText[]
  koreanLines: CardText[]
  dividerY: number
  dividerX: number
  dividerW: number
  sections: CardSection[]
  tip?: { label: CardText; lines: CardText[] }
  brandY: number
}

export function collectCardText(item: VocabularyItem): string {
  const typeLabel = TYPE_LABELS[item.type] ?? item.type
  const tip = item.context?.split("\n")[0] ?? ""
  const raw = [
    item.word,
    getKorean(item.korean_translation),
    item.definition ?? "",
    item.example_sentence ?? "",
    tip,
    typeLabel,
    typeLabel.toUpperCase(),
    "SurviveEnglish",
    "정의",
    "예문",
    "💡 팁",
    `"'`,
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?-()[] ",
  ].join("")
  return [...new Set(raw)].join("")
}

export function layoutVocabCard(item: VocabularyItem, measure: MeasureText): VocabCardLayout {
  const cX = VOCAB_CARD_MARGIN
  const cY = VOCAB_CARD_MARGIN
  const cW = VOCAB_CARD_W - VOCAB_CARD_MARGIN * 2
  const cH = VOCAB_CARD_H - VOCAB_CARD_MARGIN * 2
  const cx = cX + VOCAB_CARD_PAD
  const cw = cW - VOCAB_CARD_PAD * 2
  let y = cY + 72

  const korean = getKorean(item.korean_translation)
  const typeLabel = TYPE_LABELS[item.type] ?? item.type
  const badgeText = typeLabel.toUpperCase()
  const badgeSpec: FontSpec = { size: 28, weight: "600" }
  const bw = measure(badgeText, badgeSpec) + 44
  const bh = 46

  const badge = {
    rect: {
      x: cx,
      y,
      w: bw,
      h: bh,
      r: 23,
      fill: "rgba(99,102,241,0.18)",
      stroke: "rgba(129,140,248,0.45)",
      strokeWidth: 1.5,
    },
    label: {
      text: badgeText,
      x: cx + 22,
      y: y + bh / 2,
      size: 28,
      weight: "600",
      color: "#a5b4fc",
      baseline: "middle" as const,
    },
  }
  y += bh + 44

  const wSize = wordFontSize(item.word)
  const wSpec: FontSpec = { size: wSize, weight: "800" }
  const wordLines = wrapLines((t) => measure(t, wSpec), item.word, cw, 2).map((text) => {
    const line: CardText = {
      text,
      x: cx,
      y,
      size: wSize,
      weight: "800",
      color: "#f0f0ff",
      baseline: "top",
    }
    y += wSize + 6
    return line
  })
  y += 8

  const koreanLines: CardText[] = []
  if (korean) {
    const kSize = koreanFontSize(korean)
    const kSpec: FontSpec = { size: kSize, weight: "500" }
    for (const text of wrapLines((t) => measure(t, kSpec), korean, cw, 2)) {
      koreanLines.push({
        text,
        x: cx,
        y,
        size: kSize,
        weight: "500",
        color: "rgba(165,180,252,0.88)",
        baseline: "top",
      })
      y += kSize + 10
    }
    y += 8
  }

  y += 12
  const dividerY = y
  y += 36

  const sections: CardSection[] = []

  const addSection = (
    label: string,
    text: string,
    opts: {
      maxLines?: number
      textColor?: string
      labelColor?: string
      boxed?: boolean
      italic?: boolean
    } = {},
  ) => {
    const {
      maxLines = 4,
      textColor = "rgba(215,215,235,0.88)",
      labelColor = "rgba(129,140,248,0.65)",
      boxed = false,
      italic = false,
    } = opts

    const labelLine: CardText = {
      text: label.toUpperCase(),
      x: cx,
      y,
      size: 26,
      weight: "700",
      color: labelColor,
      baseline: "top",
    }
    y += 38

    const tSpec: FontSpec = { size: 30, weight: "400", style: italic ? "italic" : undefined }
    const lines = wrapLines((t) => measure(t, tSpec), text, boxed ? cw - 48 : cw, maxLines)
    const boxH = lines.length * 44 + 36
    const box: CardRect | undefined = boxed
      ? {
          x: cx,
          y,
          w: cw,
          h: boxH,
          r: 18,
          fill: "rgba(99,102,241,0.10)",
          stroke: "rgba(99,102,241,0.28)",
          strokeWidth: 1.5,
        }
      : undefined
    const lx = boxed ? cx + 24 : cx
    let ly = boxed ? y + 18 : y
    const textLines = lines.map((lineText) => {
      const line: CardText = {
        text: lineText,
        x: lx,
        y: ly,
        size: 30,
        weight: "400",
        style: italic ? "italic" : undefined,
        color: textColor,
        baseline: "top",
      }
      ly += 44
      return line
    })
    y += boxed ? boxH + 28 : lines.length * 44 + 28
    sections.push({ label: labelLine, lines: textLines, box })
  }

  if (item.definition) {
    addSection("정의", item.definition, { maxLines: 4 })
  }
  if (item.example_sentence) {
    addSection("예문", `"${item.example_sentence}"`, {
      maxLines: 3,
      boxed: true,
      italic: true,
      textColor: "rgba(224,224,246,0.92)",
    })
  }

  let tip: VocabCardLayout["tip"]
  if (item.context) {
    const tipText = item.context.split("\n")[0] ?? ""
    if (tipText.trim()) {
      const label: CardText = {
        text: "💡 팁",
        x: cx,
        y,
        size: 26,
        weight: "700",
        color: "rgba(251,191,36,0.65)",
        baseline: "top",
      }
      y += 38
      const spec: FontSpec = { size: 28, weight: "400" }
      const lines = wrapLines((t) => measure(t, spec), tipText, cw, 2).map((text) => {
        const line: CardText = {
          text,
          x: cx,
          y,
          size: 28,
          weight: "400",
          color: "rgba(251,191,36,0.82)",
          baseline: "top",
        }
        y += 40
        return line
      })
      tip = { label, lines }
    }
  }

  return {
    korean,
    typeLabel,
    word: item.word,
    badge,
    wordLines,
    koreanLines,
    dividerY,
    dividerX: cx,
    dividerW: cw,
    sections,
    tip,
    brandY: cY + cH - 52,
  }
}
