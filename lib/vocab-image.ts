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

/** Light studio cards — white canvas, refined ink colors for type. */
const PALETTES: VocabPalette[] = [
  {
    id: "harbor",
    bg0: "#f4f9fc", bg1: "#eef6fb",
    glow: "rgba(14,165,233,0.12)",
    card: "#ffffff",
    border: "rgba(14,116,144,0.14)",
    accent0: "#0284c7", accent1: "#0ea5e9", accent2: "#38bdf8",
    badgeFill: "rgba(14,165,233,0.10)", badgeBorder: "rgba(2,132,199,0.28)", badgeText: "#0369a1",
    word: "#0c4a6e", korean: "#0284c7",
    body: "#334155", label: "#0284c7",
    quoteFill: "rgba(14,165,233,0.06)", quoteBorder: "rgba(14,165,233,0.18)", quoteText: "#0f172a",
    tip: "#b45309", tipDim: "#d97706",
    brand: "rgba(2,132,199,0.55)", brandDot: "#0ea5e9",
  },
  {
    id: "coral",
    bg0: "#fff7f6", bg1: "#fff1f0",
    glow: "rgba(244,63,94,0.10)",
    card: "#ffffff",
    border: "rgba(225,29,72,0.14)",
    accent0: "#e11d48", accent1: "#f43f5e", accent2: "#fb7185",
    badgeFill: "rgba(244,63,94,0.08)", badgeBorder: "rgba(225,29,72,0.26)", badgeText: "#be123c",
    word: "#881337", korean: "#e11d48",
    body: "#3f3f46", label: "#e11d48",
    quoteFill: "rgba(244,63,94,0.05)", quoteBorder: "rgba(244,63,94,0.16)", quoteText: "#18181b",
    tip: "#b45309", tipDim: "#d97706",
    brand: "rgba(225,29,72,0.5)", brandDot: "#f43f5e",
  },
  {
    id: "matcha",
    bg0: "#f5fbf7", bg1: "#eef8f2",
    glow: "rgba(16,185,129,0.11)",
    card: "#ffffff",
    border: "rgba(5,150,105,0.14)",
    accent0: "#059669", accent1: "#10b981", accent2: "#34d399",
    badgeFill: "rgba(16,185,129,0.09)", badgeBorder: "rgba(5,150,105,0.26)", badgeText: "#047857",
    word: "#064e3b", korean: "#059669",
    body: "#334155", label: "#059669",
    quoteFill: "rgba(16,185,129,0.06)", quoteBorder: "rgba(16,185,129,0.16)", quoteText: "#0f172a",
    tip: "#b45309", tipDim: "#d97706",
    brand: "rgba(5,150,105,0.5)", brandDot: "#10b981",
  },
  {
    id: "amber",
    bg0: "#fffbf2", bg1: "#fff7e8",
    glow: "rgba(245,158,11,0.12)",
    card: "#ffffff",
    border: "rgba(217,119,6,0.16)",
    accent0: "#d97706", accent1: "#f59e0b", accent2: "#fbbf24",
    badgeFill: "rgba(245,158,11,0.10)", badgeBorder: "rgba(217,119,6,0.28)", badgeText: "#b45309",
    word: "#78350f", korean: "#d97706",
    body: "#44403c", label: "#d97706",
    quoteFill: "rgba(245,158,11,0.07)", quoteBorder: "rgba(245,158,11,0.18)", quoteText: "#1c1917",
    tip: "#047857", tipDim: "#059669",
    brand: "rgba(217,119,6,0.5)", brandDot: "#f59e0b",
  },
  {
    id: "lilac",
    bg0: "#faf8ff", bg1: "#f4f0ff",
    glow: "rgba(139,92,246,0.10)",
    card: "#ffffff",
    border: "rgba(124,58,237,0.14)",
    accent0: "#7c3aed", accent1: "#8b5cf6", accent2: "#a78bfa",
    badgeFill: "rgba(139,92,246,0.09)", badgeBorder: "rgba(124,58,237,0.26)", badgeText: "#6d28d9",
    word: "#4c1d95", korean: "#7c3aed",
    body: "#3f3f46", label: "#7c3aed",
    quoteFill: "rgba(139,92,246,0.06)", quoteBorder: "rgba(139,92,246,0.16)", quoteText: "#18181b",
    tip: "#b45309", tipDim: "#d97706",
    brand: "rgba(124,58,237,0.5)", brandDot: "#8b5cf6",
  },
  {
    id: "slate",
    bg0: "#f7f8fa", bg1: "#f1f3f6",
    glow: "rgba(100,116,139,0.10)",
    card: "#ffffff",
    border: "rgba(71,85,105,0.14)",
    accent0: "#475569", accent1: "#64748b", accent2: "#94a3b8",
    badgeFill: "rgba(100,116,139,0.10)", badgeBorder: "rgba(71,85,105,0.24)", badgeText: "#334155",
    word: "#0f172a", korean: "#475569",
    body: "#334155", label: "#64748b",
    quoteFill: "rgba(100,116,139,0.07)", quoteBorder: "rgba(100,116,139,0.16)", quoteText: "#0f172a",
    tip: "#0284c7", tipDim: "#0ea5e9",
    brand: "rgba(71,85,105,0.5)", brandDot: "#64748b",
  },
  {
    id: "ocean",
    bg0: "#f3fbfa", bg1: "#ebf8f6",
    glow: "rgba(20,184,166,0.11)",
    card: "#ffffff",
    border: "rgba(13,148,136,0.14)",
    accent0: "#0d9488", accent1: "#14b8a6", accent2: "#2dd4bf",
    badgeFill: "rgba(20,184,166,0.09)", badgeBorder: "rgba(13,148,136,0.26)", badgeText: "#0f766e",
    word: "#134e4a", korean: "#0d9488",
    body: "#334155", label: "#0d9488",
    quoteFill: "rgba(20,184,166,0.06)", quoteBorder: "rgba(20,184,166,0.16)", quoteText: "#0f172a",
    tip: "#c2410c", tipDim: "#ea580c",
    brand: "rgba(13,148,136,0.5)", brandDot: "#14b8a6",
  },
  {
    id: "rose",
    bg0: "#fff7fb", bg1: "#fdf0f7",
    glow: "rgba(236,72,153,0.10)",
    card: "#ffffff",
    border: "rgba(219,39,119,0.14)",
    accent0: "#db2777", accent1: "#ec4899", accent2: "#f472b6",
    badgeFill: "rgba(236,72,153,0.08)", badgeBorder: "rgba(219,39,119,0.26)", badgeText: "#be185d",
    word: "#831843", korean: "#db2777",
    body: "#3f3f46", label: "#db2777",
    quoteFill: "rgba(236,72,153,0.05)", quoteBorder: "rgba(236,72,153,0.16)", quoteText: "#18181b",
    tip: "#7c3aed", tipDim: "#8b5cf6",
    brand: "rgba(219,39,119,0.5)", brandDot: "#ec4899",
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
  ctx.shadowColor = "rgba(15,23,42,0.10)"
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 12
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
