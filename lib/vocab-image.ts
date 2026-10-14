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

const PALETTES: VocabPalette[] = [
  {
    id: "harbor",
    bg0: "#0b1f2a", bg1: "#07141c",
    glow: "rgba(56,189,248,0.14)",
    card: "rgba(12,32,44,0.97)",
    border: "rgba(56,189,248,0.28)",
    accent0: "#0ea5e9", accent1: "#38bdf8", accent2: "#7dd3fc",
    badgeFill: "rgba(14,165,233,0.16)", badgeBorder: "rgba(125,211,252,0.45)", badgeText: "#7dd3fc",
    word: "#f0f9ff", korean: "rgba(125,211,252,0.9)",
    body: "rgba(224,242,254,0.88)", label: "rgba(56,189,248,0.7)",
    quoteFill: "rgba(14,165,233,0.1)", quoteBorder: "rgba(56,189,248,0.32)", quoteText: "rgba(240,249,255,0.94)",
    tip: "rgba(251,191,36,0.88)", tipDim: "rgba(251,191,36,0.65)",
    brand: "rgba(125,211,252,0.45)", brandDot: "rgba(14,165,233,0.55)",
  },
  {
    id: "coral",
    bg0: "#2a1214", bg1: "#18090b",
    glow: "rgba(251,113,133,0.14)",
    card: "rgba(42,20,24,0.97)",
    border: "rgba(251,113,133,0.28)",
    accent0: "#f43f5e", accent1: "#fb7185", accent2: "#fda4af",
    badgeFill: "rgba(244,63,94,0.16)", badgeBorder: "rgba(253,164,175,0.45)", badgeText: "#fda4af",
    word: "#fff1f2", korean: "rgba(253,164,175,0.92)",
    body: "rgba(255,228,230,0.88)", label: "rgba(251,113,133,0.72)",
    quoteFill: "rgba(244,63,94,0.1)", quoteBorder: "rgba(251,113,133,0.32)", quoteText: "rgba(255,241,242,0.94)",
    tip: "rgba(252,211,77,0.9)", tipDim: "rgba(252,211,77,0.65)",
    brand: "rgba(253,164,175,0.45)", brandDot: "rgba(244,63,94,0.55)",
  },
  {
    id: "matcha",
    bg0: "#102018", bg1: "#08140e",
    glow: "rgba(52,211,153,0.13)",
    card: "rgba(16,36,26,0.97)",
    border: "rgba(52,211,153,0.26)",
    accent0: "#10b981", accent1: "#34d399", accent2: "#6ee7b7",
    badgeFill: "rgba(16,185,129,0.15)", badgeBorder: "rgba(110,231,183,0.42)", badgeText: "#6ee7b7",
    word: "#ecfdf5", korean: "rgba(110,231,183,0.9)",
    body: "rgba(209,250,229,0.88)", label: "rgba(52,211,153,0.7)",
    quoteFill: "rgba(16,185,129,0.1)", quoteBorder: "rgba(52,211,153,0.3)", quoteText: "rgba(236,253,245,0.94)",
    tip: "rgba(251,191,36,0.88)", tipDim: "rgba(251,191,36,0.65)",
    brand: "rgba(110,231,183,0.42)", brandDot: "rgba(16,185,129,0.55)",
  },
  {
    id: "amber",
    bg0: "#24180a", bg1: "#140d05",
    glow: "rgba(251,191,36,0.14)",
    card: "rgba(38,26,12,0.97)",
    border: "rgba(251,191,36,0.28)",
    accent0: "#f59e0b", accent1: "#fbbf24", accent2: "#fcd34d",
    badgeFill: "rgba(245,158,11,0.16)", badgeBorder: "rgba(252,211,77,0.45)", badgeText: "#fcd34d",
    word: "#fffbeb", korean: "rgba(252,211,77,0.9)",
    body: "rgba(254,243,199,0.88)", label: "rgba(251,191,36,0.72)",
    quoteFill: "rgba(245,158,11,0.1)", quoteBorder: "rgba(251,191,36,0.32)", quoteText: "rgba(255,251,235,0.94)",
    tip: "rgba(110,231,183,0.9)", tipDim: "rgba(110,231,183,0.65)",
    brand: "rgba(252,211,77,0.42)", brandDot: "rgba(245,158,11,0.55)",
  },
  {
    id: "lilac",
    bg0: "#1a1428", bg1: "#0e0a18",
    glow: "rgba(167,139,250,0.14)",
    card: "rgba(28,22,44,0.97)",
    border: "rgba(167,139,250,0.28)",
    accent0: "#8b5cf6", accent1: "#a78bfa", accent2: "#c4b5fd",
    badgeFill: "rgba(139,92,246,0.16)", badgeBorder: "rgba(196,181,253,0.45)", badgeText: "#c4b5fd",
    word: "#f5f3ff", korean: "rgba(196,181,253,0.9)",
    body: "rgba(237,233,254,0.88)", label: "rgba(167,139,250,0.7)",
    quoteFill: "rgba(139,92,246,0.1)", quoteBorder: "rgba(167,139,250,0.32)", quoteText: "rgba(245,243,255,0.94)",
    tip: "rgba(251,191,36,0.88)", tipDim: "rgba(251,191,36,0.65)",
    brand: "rgba(196,181,253,0.42)", brandDot: "rgba(139,92,246,0.55)",
  },
  {
    id: "slate",
    bg0: "#141820", bg1: "#0a0d12",
    glow: "rgba(148,163,184,0.12)",
    card: "rgba(22,26,34,0.97)",
    border: "rgba(148,163,184,0.28)",
    accent0: "#64748b", accent1: "#94a3b8", accent2: "#cbd5e1",
    badgeFill: "rgba(100,116,139,0.18)", badgeBorder: "rgba(203,213,225,0.4)", badgeText: "#cbd5e1",
    word: "#f8fafc", korean: "rgba(203,213,225,0.9)",
    body: "rgba(226,232,240,0.88)", label: "rgba(148,163,184,0.72)",
    quoteFill: "rgba(100,116,139,0.12)", quoteBorder: "rgba(148,163,184,0.32)", quoteText: "rgba(248,250,252,0.94)",
    tip: "rgba(56,189,248,0.88)", tipDim: "rgba(56,189,248,0.65)",
    brand: "rgba(203,213,225,0.42)", brandDot: "rgba(100,116,139,0.55)",
  },
  {
    id: "ocean",
    bg0: "#0a1e2e", bg1: "#061018",
    glow: "rgba(45,212,191,0.13)",
    card: "rgba(12,34,48,0.97)",
    border: "rgba(45,212,191,0.26)",
    accent0: "#14b8a6", accent1: "#2dd4bf", accent2: "#5eead4",
    badgeFill: "rgba(20,184,166,0.15)", badgeBorder: "rgba(94,234,212,0.42)", badgeText: "#5eead4",
    word: "#f0fdfa", korean: "rgba(94,234,212,0.9)",
    body: "rgba(204,251,241,0.88)", label: "rgba(45,212,191,0.7)",
    quoteFill: "rgba(20,184,166,0.1)", quoteBorder: "rgba(45,212,191,0.3)", quoteText: "rgba(240,253,250,0.94)",
    tip: "rgba(251,146,60,0.9)", tipDim: "rgba(251,146,60,0.65)",
    brand: "rgba(94,234,212,0.42)", brandDot: "rgba(20,184,166,0.55)",
  },
  {
    id: "rose",
    bg0: "#26141c", bg1: "#160a10",
    glow: "rgba(244,114,182,0.13)",
    card: "rgba(40,22,32,0.97)",
    border: "rgba(244,114,182,0.28)",
    accent0: "#ec4899", accent1: "#f472b6", accent2: "#f9a8d4",
    badgeFill: "rgba(236,72,153,0.15)", badgeBorder: "rgba(249,168,212,0.42)", badgeText: "#f9a8d4",
    word: "#fdf2f8", korean: "rgba(249,168,212,0.9)",
    body: "rgba(252,231,243,0.88)", label: "rgba(244,114,182,0.7)",
    quoteFill: "rgba(236,72,153,0.1)", quoteBorder: "rgba(244,114,182,0.3)", quoteText: "rgba(253,242,248,0.94)",
    tip: "rgba(167,139,250,0.9)", tipDim: "rgba(167,139,250,0.65)",
    brand: "rgba(249,168,212,0.42)", brandDot: "rgba(236,72,153,0.55)",
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

  // Soft radial glow (top-left)
  const glow = ctx.createRadialGradient(W * 0.18, H * 0.18, 0, W * 0.18, H * 0.18, 620)
  glow.addColorStop(0, p.glow)
  glow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Secondary wash (bottom-right) for depth without clutter
  const wash = ctx.createRadialGradient(W * 0.85, H * 0.85, 0, W * 0.85, H * 0.85, 500)
  wash.addColorStop(0, p.glow.replace(/[\d.]+\)$/, "0.08)"))
  wash.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, W, H)

  // ── Card ──────────────────────────────────────────────────────────────────
  const MG = 64
  const cX = MG, cY = MG, cW = W - MG * 2, cH = H - MG * 2

  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.55)"
  ctx.shadowBlur = 56
  ctx.shadowOffsetY = 14
  roundRect(ctx, cX, cY, cW, cH, 44)
  ctx.fillStyle = p.card
  ctx.fill()
  ctx.restore()

  roundRect(ctx, cX, cY, cW, cH, 44)
  ctx.strokeStyle = p.border
  ctx.lineWidth = 2
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

  // Divider — same accent language as the top bar
  y += 12
  const divGrad = ctx.createLinearGradient(cx, 0, cx + cw, 0)
  divGrad.addColorStop(0, p.accent0)
  divGrad.addColorStop(0.55, p.accent1)
  divGrad.addColorStop(1, "rgba(255,255,255,0)")
  ctx.strokeStyle = divGrad
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx, y)
  ctx.lineTo(cx + cw * 0.72, y)
  ctx.stroke()
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
