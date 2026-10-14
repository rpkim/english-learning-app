import type { VocabularyItem } from "@/lib/types"

// ── Helpers ────────────────────────────────────────────────────────────────

function getKorean(raw: unknown): string {
  if (typeof raw === "string") return raw
  if (!raw || typeof raw !== "object") return ""
  const obj = raw as Record<string, unknown>
  return (
    (typeof obj.korean_translation === "string" ? obj.korean_translation : "") ||
    (typeof obj.meaning === "string" ? obj.meaning : "") ||
    (typeof obj.usage === "string" ? obj.usage : "")
  )
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number | [number, number, number, number]
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 99
): string[] {
  const paragraphs = text.split("\n")
  const lines: string[] = []
  for (const para of paragraphs) {
    if (lines.length >= maxLines) break
    const words = para.split(" ")
    let current = ""
    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && current) {
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

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Shared editorial card language — varied hues, same structure & polish. */
type VocabPalette = {
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
const PALETTES: VocabPalette[] = [
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
]

function pickPalette(item: VocabularyItem): VocabPalette {
  const seed = `${item.id ?? ""}|${item.word}|${item.type}`
  return PALETTES[hashString(seed) % PALETTES.length]!
}

// ── Main export ────────────────────────────────────────────────────────────

export function downloadVocabImage(item: VocabularyItem): void {
  const W = 1080
  const H = 1350
  const p = pickPalette(item)

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!

  const font = (size: number, weight = "400", style = "") =>
    `${style} ${weight} ${size}px -apple-system, 'Pretendard', 'Noto Sans KR', sans-serif`.trim()

  // ── Background ────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W * 0.55, H)
  bg.addColorStop(0, p.bg0)
  bg.addColorStop(1, p.bg1)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Soft tint washes — airy, not dark
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

  // ── Card ──────────────────────────────────────────────────────────────────
  const MG = 64
  const cX = MG, cY = MG, cW = W - MG * 2, cH = H - MG * 2

  ctx.save()
  ctx.shadowColor = "rgba(15,23,42,0.07)"
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 10
  roundRect(ctx, cX, cY, cW, cH, 44)
  ctx.fillStyle = p.card
  ctx.fill()
  ctx.restore()

  roundRect(ctx, cX, cY, cW, cH, 44)
  ctx.strokeStyle = p.border
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Top accent bar — shared structural identity across palettes
  const accentGrad = ctx.createLinearGradient(cX, 0, cX + cW, 0)
  accentGrad.addColorStop(0, p.accent0)
  accentGrad.addColorStop(0.5, p.accent1)
  accentGrad.addColorStop(1, p.accent2)
  roundRect(ctx, cX, cY, cW, 12, [44, 44, 0, 0])
  ctx.fillStyle = accentGrad
  ctx.fill()

  // ── Content ───────────────────────────────────────────────────────────────
  const PAD = 84
  const cx = cX + PAD
  const cw = cW - PAD * 2
  let y = cY + 72

  const korean = getKorean(item.korean_translation)

  const TYPE_LABELS: Record<string, string> = {
    word: "Word",
    idiom: "Idiom",
    slang: "Slang",
    phrasal_verb: "Phrasal",
    expression: "Expression",
  }
  const typeLabel = TYPE_LABELS[item.type] ?? item.type

  // Type badge
  ctx.font = font(28, "600")
  const badgeText = typeLabel.toUpperCase()
  const bw = ctx.measureText(badgeText).width + 44
  const bh = 46
  roundRect(ctx, cx, y, bw, bh, 23)
  ctx.fillStyle = p.badgeFill
  ctx.fill()
  ctx.strokeStyle = p.badgeBorder
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = p.badgeText
  ctx.textBaseline = "middle"
  ctx.fillText(badgeText, cx + 22, y + bh / 2)
  y += bh + 44

  // Word
  const wordLen = item.word.length
  const wordSize = wordLen > 18 ? 68 : wordLen > 12 ? 82 : wordLen > 8 ? 92 : 104
  ctx.font = font(wordSize, "800")
  ctx.fillStyle = p.word
  ctx.textBaseline = "top"
  const wordLines = wrapText(ctx, item.word, cw, 2)
  for (const line of wordLines) {
    ctx.fillText(line, cx, y)
    y += wordSize + 6
  }
  y += 8

  // Korean meaning
  if (korean) {
    const korSize = korean.length > 24 ? 34 : 40
    ctx.font = font(korSize, "500")
    ctx.fillStyle = p.korean
    const kLines = wrapText(ctx, korean, cw, 2)
    for (const line of kLines) {
      ctx.fillText(line, cx, y)
      y += korSize + 10
    }
    y += 8
  }

  // Divider — soft accent fade on light paper
  y += 12
  const divGrad = ctx.createLinearGradient(cx, 0, cx + cw, 0)
  divGrad.addColorStop(0, p.accent0)
  divGrad.addColorStop(0.55, p.accent1)
  divGrad.addColorStop(1, "rgba(255,255,255,0)")
  ctx.globalAlpha = 0.55
  ctx.strokeStyle = divGrad
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx, y)
  ctx.lineTo(cx + cw * 0.72, y)
  ctx.stroke()
  ctx.globalAlpha = 1
  y += 36

  // ── Section helper ────────────────────────────────────────────────────────
  const section = (label: string, text: string, opts?: {
    maxLines?: number
    textColor?: string
    labelColor?: string
    boxed?: boolean
    italic?: boolean
  }) => {
    const {
      maxLines = 4,
      textColor = p.body,
      labelColor = p.label,
      boxed = false,
      italic = false,
    } = opts ?? {}

    ctx.font = font(26, "700")
    ctx.fillStyle = labelColor
    ctx.textBaseline = "top"
    ctx.fillText(label.toUpperCase(), cx, y)
    y += 38

    ctx.font = italic ? font(30, "400", "italic") : font(30, "400")
    ctx.fillStyle = textColor

    const lines = wrapText(ctx, text, boxed ? cw - 48 : cw, maxLines)
    const boxH = lines.length * 44 + 36

    if (boxed) {
      roundRect(ctx, cx, y, cw, boxH, 18)
      ctx.fillStyle = p.quoteFill
      ctx.fill()
      ctx.strokeStyle = p.quoteBorder
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    const lx = boxed ? cx + 24 : cx
    let ly = boxed ? y + 18 : y
    ctx.fillStyle = textColor
    for (const line of lines) {
      ctx.fillText(line, lx, ly)
      ly += 44
    }
    y += boxed ? boxH + 28 : lines.length * 44 + 28
  }

  if (item.definition) {
    section("정의", item.definition, { maxLines: 4 })
  }

  if (item.example_sentence) {
    section("예문", `"${item.example_sentence}"`, {
      maxLines: 3,
      boxed: true,
      italic: true,
      textColor: p.quoteText,
    })
  }

  if (item.context) {
    const tipText = item.context.split("\n")[0] ?? ""
    if (tipText.trim()) {
      ctx.font = font(26, "700")
      ctx.fillStyle = p.tipDim
      ctx.textBaseline = "top"
      ctx.fillText("TIP", cx, y)
      y += 38
      ctx.font = font(28, "400")
      ctx.fillStyle = p.tip
      const tipLines = wrapText(ctx, tipText, cw, 2)
      for (const line of tipLines) {
        ctx.fillText(line, cx, y)
        y += 40
      }
    }
  }

  // ── Branding ──────────────────────────────────────────────────────────────
  ctx.font = font(30, "700")
  ctx.textBaseline = "middle"
  ctx.textAlign = "center"

  const brandY = cY + cH - 52
  ctx.beginPath()
  ctx.arc(W / 2 - 96, brandY, 6, 0, Math.PI * 2)
  ctx.fillStyle = p.brandDot
  ctx.fill()

  ctx.fillStyle = p.brand
  ctx.fillText("SurviveEnglish", W / 2, brandY)
  ctx.textAlign = "left"

  // ── Download ──────────────────────────────────────────────────────────────
  const filename = `${item.word.replace(/[^a-zA-Z0-9가-힣\-_]/g, "-")}.png`

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
