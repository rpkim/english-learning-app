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

// ── Main export ────────────────────────────────────────────────────────────

export function downloadVocabImage(item: VocabularyItem): void {
  const W = 1080
  const H = 1350

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!

  const font = (size: number, weight = "400", style = "") =>
    `${style} ${weight} ${size}px -apple-system, 'Pretendard', 'Noto Sans KR', sans-serif`.trim()

  // ── Background ────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W * 0.6, H)
  bg.addColorStop(0, "#0c0c1d")
  bg.addColorStop(1, "#08080f")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Subtle radial glow
  const glow = ctx.createRadialGradient(W * 0.15, H * 0.2, 0, W * 0.15, H * 0.2, 600)
  glow.addColorStop(0, "rgba(99,102,241,0.10)")
  glow.addColorStop(1, "rgba(99,102,241,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // ── Card ──────────────────────────────────────────────────────────────────
  const MG = 64
  const cX = MG, cY = MG, cW = W - MG * 2, cH = H - MG * 2

  // Card shadow (fake — slightly larger offset rect)
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.6)"
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 12
  roundRect(ctx, cX, cY, cW, cH, 44)
  ctx.fillStyle = "rgba(16,16,32,0.98)"
  ctx.fill()
  ctx.restore()

  // Card border
  roundRect(ctx, cX, cY, cW, cH, 44)
  ctx.strokeStyle = "rgba(99,102,241,0.22)"
  ctx.lineWidth = 2
  ctx.stroke()

  // Top accent bar
  const accentGrad = ctx.createLinearGradient(cX, 0, cX + cW, 0)
  accentGrad.addColorStop(0, "#6366f1")
  accentGrad.addColorStop(0.5, "#818cf8")
  accentGrad.addColorStop(1, "#a78bfa")
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
  ctx.fillStyle = "rgba(99,102,241,0.18)"
  ctx.fill()
  ctx.strokeStyle = "rgba(129,140,248,0.45)"
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = "#a5b4fc"
  ctx.textBaseline = "middle"
  ctx.fillText(badgeText, cx + 22, y + bh / 2)
  y += bh + 44

  // Word
  const wordLen = item.word.length
  const wordSize = wordLen > 18 ? 68 : wordLen > 12 ? 82 : wordLen > 8 ? 92 : 104
  ctx.font = font(wordSize, "800")
  ctx.fillStyle = "#f0f0ff"
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
    ctx.fillStyle = "rgba(165,180,252,0.88)"
    const kLines = wrapText(ctx, korean, cw, 2)
    for (const line of kLines) {
      ctx.fillText(line, cx, y)
      y += korSize + 10
    }
    y += 8
  }

  // Divider
  y += 12
  const divGrad = ctx.createLinearGradient(cx, 0, cx + cw, 0)
  divGrad.addColorStop(0, "rgba(99,102,241,0.5)")
  divGrad.addColorStop(0.5, "rgba(99,102,241,0.15)")
  divGrad.addColorStop(1, "rgba(99,102,241,0.0)")
  ctx.strokeStyle = divGrad
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx, y)
  ctx.lineTo(cx + cw, y)
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
      textColor = "rgba(215,215,235,0.88)",
      labelColor = "rgba(129,140,248,0.65)",
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
      ctx.fillStyle = "rgba(99,102,241,0.10)"
      ctx.fill()
      ctx.strokeStyle = "rgba(99,102,241,0.28)"
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

  // Definition
  if (item.definition) {
    section("정의", item.definition, { maxLines: 4 })
  }

  // Example sentence
  if (item.example_sentence) {
    section("예문", `"${item.example_sentence}"`, {
      maxLines: 3,
      boxed: true,
      italic: true,
      textColor: "rgba(224,224,246,0.92)",
    })
  }

  // Context / tip
  if (item.context) {
    const tipText = item.context.split("\n")[0] ?? ""
    if (tipText.trim()) {
      ctx.font = font(26, "700")
      ctx.fillStyle = "rgba(251,191,36,0.65)"
      ctx.textBaseline = "top"
      ctx.fillText("💡 팁", cx, y)
      y += 38
      ctx.font = font(28, "400")
      ctx.fillStyle = "rgba(251,191,36,0.82)"
      const tipLines = wrapText(ctx, tipText, cw, 2)
      for (const line of tipLines) {
        ctx.fillText(line, cx, y)
        y += 40
      }
    }
  }

  // ── Branding ──────────────────────────────────────────────────────────────
  ctx.font = font(30, "700")
  ctx.fillStyle = "rgba(129,140,248,0.4)"
  ctx.textBaseline = "middle"
  ctx.textAlign = "center"

  // Small logo dot before text
  const brandY = cY + cH - 52
  ctx.beginPath()
  ctx.arc(W / 2 - 96, brandY, 6, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(99,102,241,0.5)"
  ctx.fill()

  ctx.fillStyle = "rgba(129,140,248,0.45)"
  ctx.fillText("SurviveEnglish", W / 2, brandY)
  ctx.textAlign = "left"

  // ── Download ──────────────────────────────────────────────────────────────
  const filename = `${item.word.replace(/[^a-zA-Z0-9가-힣\-_]/g, "-")}.png`

  canvas.toBlob(async (blob) => {
    if (!blob) return

    // iOS Safari: use Web Share API so "Save Image" option appears
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

    // Desktop / Android: anchor download
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
