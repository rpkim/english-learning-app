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

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type VocabPalette = {
  id: string
  bg0: string
  bg1: string
  glow: string
  card: string
  border: string
  accent0: string
  accent1: string
  accent2: string
  badgeFill: string
  badgeBorder: string
  badgeText: string
  word: string
  korean: string
  body: string
  label: string
  quoteFill: string
  quoteBorder: string
  quoteText: string
  tip: string
  tipDim: string
  brand: string
  brandDot: string
}

/**
 * Young bright cards — pure white + pastel wash.
 * Word colors stay vivid mid-tones (never near-black burgundy/ink).
 */
export const VOCAB_PALETTES: VocabPalette[] = [
  {
    id: "aqua",
    bg0: "#f3fcfc", bg1: "#e8fafa",
    glow: "rgba(18,196,192,0.18)",
    card: "#ffffff",
    border: "rgba(18,196,192,0.22)",
    accent0: "#12c4c0", accent1: "#2dd4bf", accent2: "#5eead4",
    badgeFill: "rgba(18,196,192,0.12)", badgeBorder: "rgba(18,196,192,0.35)", badgeText: "#0d9488",
    word: "#0f9f9b", korean: "#12c4c0",
    body: "#475569", label: "#12c4c0",
    quoteFill: "rgba(18,196,192,0.08)", quoteBorder: "rgba(18,196,192,0.22)", quoteText: "#334155",
    tip: "#fb923c", tipDim: "#f97316",
    brand: "rgba(18,196,192,0.65)", brandDot: "#12c4c0",
  },
  {
    id: "sky",
    bg0: "#f3f9ff", bg1: "#e8f3ff",
    glow: "rgba(56,189,248,0.18)",
    card: "#ffffff",
    border: "rgba(14,165,233,0.2)",
    accent0: "#0ea5e9", accent1: "#38bdf8", accent2: "#7dd3fc",
    badgeFill: "rgba(14,165,233,0.12)", badgeBorder: "rgba(14,165,233,0.32)", badgeText: "#0284c7",
    word: "#0284c7", korean: "#0ea5e9",
    body: "#475569", label: "#0ea5e9",
    quoteFill: "rgba(14,165,233,0.08)", quoteBorder: "rgba(14,165,233,0.2)", quoteText: "#334155",
    tip: "#f59e0b", tipDim: "#fbbf24",
    brand: "rgba(14,165,233,0.6)", brandDot: "#0ea5e9",
  },
  {
    id: "coral",
    bg0: "#fff6f5", bg1: "#ffecea",
    glow: "rgba(251,113,133,0.16)",
    card: "#ffffff",
    border: "rgba(251,113,133,0.22)",
    accent0: "#fb7185", accent1: "#fda4af", accent2: "#fecdd3",
    badgeFill: "rgba(251,113,133,0.12)", badgeBorder: "rgba(251,113,133,0.32)", badgeText: "#f43f5e",
    word: "#f43f5e", korean: "#fb7185",
    body: "#57534e", label: "#f43f5e",
    quoteFill: "rgba(251,113,133,0.08)", quoteBorder: "rgba(251,113,133,0.2)", quoteText: "#44403c",
    tip: "#f59e0b", tipDim: "#fbbf24",
    brand: "rgba(244,63,94,0.55)", brandDot: "#fb7185",
  },
  {
    id: "mint",
    bg0: "#f3fcf7", bg1: "#e6f9ef",
    glow: "rgba(52,211,153,0.18)",
    card: "#ffffff",
    border: "rgba(52,211,153,0.22)",
    accent0: "#34d399", accent1: "#6ee7b7", accent2: "#a7f3d0",
    badgeFill: "rgba(52,211,153,0.12)", badgeBorder: "rgba(52,211,153,0.32)", badgeText: "#10b981",
    word: "#10b981", korean: "#34d399",
    body: "#475569", label: "#10b981",
    quoteFill: "rgba(52,211,153,0.08)", quoteBorder: "rgba(52,211,153,0.2)", quoteText: "#334155",
    tip: "#fb923c", tipDim: "#fdba74",
    brand: "rgba(16,185,129,0.55)", brandDot: "#34d399",
  },
  {
    id: "peach",
    bg0: "#fff8f2", bg1: "#ffefe3",
    glow: "rgba(251,146,60,0.16)",
    card: "#ffffff",
    border: "rgba(251,146,60,0.22)",
    accent0: "#fb923c", accent1: "#fdba74", accent2: "#fed7aa",
    badgeFill: "rgba(251,146,60,0.12)", badgeBorder: "rgba(251,146,60,0.32)", badgeText: "#f97316",
    word: "#ea580c", korean: "#fb923c",
    body: "#57534e", label: "#f97316",
    quoteFill: "rgba(251,146,60,0.08)", quoteBorder: "rgba(251,146,60,0.2)", quoteText: "#44403c",
    tip: "#12c4c0", tipDim: "#2dd4bf",
    brand: "rgba(249,115,22,0.55)", brandDot: "#fb923c",
  },
  {
    id: "lemon",
    bg0: "#fffcef", bg1: "#fff7d6",
    glow: "rgba(250,204,21,0.18)",
    card: "#ffffff",
    border: "rgba(250,204,21,0.28)",
    accent0: "#eab308", accent1: "#facc15", accent2: "#fde047",
    badgeFill: "rgba(250,204,21,0.16)", badgeBorder: "rgba(234,179,8,0.35)", badgeText: "#ca8a04",
    word: "#ca8a04", korean: "#eab308",
    body: "#57534e", label: "#eab308",
    quoteFill: "rgba(250,204,21,0.1)", quoteBorder: "rgba(250,204,21,0.24)", quoteText: "#44403c",
    tip: "#12c4c0", tipDim: "#2dd4bf",
    brand: "rgba(202,138,4,0.55)", brandDot: "#eab308",
  },
  {
    id: "violet",
    bg0: "#faf7ff", bg1: "#f3ecff",
    glow: "rgba(167,139,250,0.16)",
    card: "#ffffff",
    border: "rgba(167,139,250,0.22)",
    accent0: "#a78bfa", accent1: "#c4b5fd", accent2: "#ddd6fe",
    badgeFill: "rgba(167,139,250,0.12)", badgeBorder: "rgba(167,139,250,0.32)", badgeText: "#8b5cf6",
    word: "#8b5cf6", korean: "#a78bfa",
    body: "#57534e", label: "#8b5cf6",
    quoteFill: "rgba(167,139,250,0.08)", quoteBorder: "rgba(167,139,250,0.2)", quoteText: "#44403c",
    tip: "#fb923c", tipDim: "#fdba74",
    brand: "rgba(139,92,246,0.55)", brandDot: "#a78bfa",
  },
  {
    id: "pink",
    bg0: "#fff5fa", bg1: "#ffe8f3",
    glow: "rgba(244,114,182,0.16)",
    card: "#ffffff",
    border: "rgba(244,114,182,0.22)",
    accent0: "#f472b6", accent1: "#f9a8d4", accent2: "#fbcfe8",
    badgeFill: "rgba(244,114,182,0.12)", badgeBorder: "rgba(244,114,182,0.32)", badgeText: "#ec4899",
    word: "#ec4899", korean: "#f472b6",
    body: "#57534e", label: "#ec4899",
    quoteFill: "rgba(244,114,182,0.08)", quoteBorder: "rgba(244,114,182,0.2)", quoteText: "#44403c",
    tip: "#12c4c0", tipDim: "#2dd4bf",
    brand: "rgba(236,72,153,0.55)", brandDot: "#f472b6",
  },
  {
    id: "lime",
    bg0: "#f7fcef", bg1: "#eef9d9",
    glow: "rgba(163,230,53,0.2)",
    card: "#ffffff",
    border: "rgba(132,204,22,0.24)",
    accent0: "#84cc16", accent1: "#a3e635", accent2: "#bef264",
    badgeFill: "rgba(163,230,53,0.14)", badgeBorder: "rgba(132,204,22,0.35)", badgeText: "#65a30d",
    word: "#65a30d", korean: "#84cc16",
    body: "#4b5563", label: "#84cc16",
    quoteFill: "rgba(163,230,53,0.1)", quoteBorder: "rgba(132,204,22,0.22)", quoteText: "#374151",
    tip: "#f97316", tipDim: "#fb923c",
    brand: "rgba(101,163,13,0.55)", brandDot: "#84cc16",
  },
  {
    id: "blueberry",
    bg0: "#f4f7ff", bg1: "#e8eeff",
    glow: "rgba(96,165,250,0.18)",
    card: "#ffffff",
    border: "rgba(96,165,250,0.24)",
    accent0: "#60a5fa", accent1: "#93c5fd", accent2: "#bfdbfe",
    badgeFill: "rgba(96,165,250,0.12)", badgeBorder: "rgba(59,130,246,0.3)", badgeText: "#3b82f6",
    word: "#3b82f6", korean: "#60a5fa",
    body: "#475569", label: "#3b82f6",
    quoteFill: "rgba(96,165,250,0.08)", quoteBorder: "rgba(96,165,250,0.2)", quoteText: "#334155",
    tip: "#f472b6", tipDim: "#f9a8d4",
    brand: "rgba(59,130,246,0.55)", brandDot: "#60a5fa",
  },
  {
    id: "tangerine",
    bg0: "#fff7f0", bg1: "#ffead6",
    glow: "rgba(249,115,22,0.16)",
    card: "#ffffff",
    border: "rgba(249,115,22,0.22)",
    accent0: "#f97316", accent1: "#fb923c", accent2: "#fdba74",
    badgeFill: "rgba(249,115,22,0.12)", badgeBorder: "rgba(249,115,22,0.32)", badgeText: "#ea580c",
    word: "#f97316", korean: "#fb923c",
    body: "#57534e", label: "#f97316",
    quoteFill: "rgba(249,115,22,0.08)", quoteBorder: "rgba(249,115,22,0.2)", quoteText: "#44403c",
    tip: "#3b82f6", tipDim: "#60a5fa",
    brand: "rgba(249,115,22,0.55)", brandDot: "#f97316",
  },
  {
    id: "berry",
    bg0: "#fdf4ff", bg1: "#fae8ff",
    glow: "rgba(232,121,249,0.16)",
    card: "#ffffff",
    border: "rgba(232,121,249,0.22)",
    accent0: "#e879f9", accent1: "#f0abfc", accent2: "#f5d0fe",
    badgeFill: "rgba(232,121,249,0.12)", badgeBorder: "rgba(217,70,239,0.3)", badgeText: "#d946ef",
    word: "#d946ef", korean: "#e879f9",
    body: "#57534e", label: "#d946ef",
    quoteFill: "rgba(232,121,249,0.08)", quoteBorder: "rgba(232,121,249,0.2)", quoteText: "#44403c",
    tip: "#12c4c0", tipDim: "#2dd4bf",
    brand: "rgba(217,70,239,0.55)", brandDot: "#e879f9",
  },
]

export function pickPalette(item: VocabularyItem): VocabPalette {
  const seed = `${item.id ?? ""}|${item.word}|${item.type}`
  return VOCAB_PALETTES[hashString(seed) % VOCAB_PALETTES.length]!
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
  palette: VocabPalette
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
    "팁",
    `"'`,
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?-()[] ",
  ].join("")
  return [...new Set(raw)].join("")
}

export function layoutVocabCard(item: VocabularyItem, measure: MeasureText): VocabCardLayout {
  const p = pickPalette(item)
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
      fill: p.badgeFill,
      stroke: p.badgeBorder,
      strokeWidth: 1.5,
    },
    label: {
      text: badgeText,
      x: cx + 22,
      y: y + bh / 2,
      size: 28,
      weight: "600",
      color: p.badgeText,
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
      color: p.word,
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
        color: p.korean,
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
      textColor = p.body,
      labelColor = p.label,
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
          fill: p.quoteFill,
          stroke: p.quoteBorder,
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
      textColor: p.quoteText,
    })
  }

  let tip: VocabCardLayout["tip"]
  if (item.context) {
    const tipText = item.context.split("\n")[0] ?? ""
    if (tipText.trim()) {
      const label: CardText = {
        text: "팁",
        x: cx,
        y,
        size: 26,
        weight: "700",
        color: p.tipDim,
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
          color: p.tip,
          baseline: "top",
        }
        y += 40
        return line
      })
      tip = { label, lines }
    }
  }

  return {
    palette: p,
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
