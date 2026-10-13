import type { EmbeddedFontFace } from "@/lib/vocab-card-svg"

const FONT_FAMILY = "Noto Sans KR"
const WEIGHTS = [400, 500, 700, 800] as const

const cache = new Map<string, EmbeddedFontFace>()

const LEGACY_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1"

function cacheKey(weight: number, glyphs: string): string {
  return `${weight}:${glyphs}`
}

function parseFontUrl(css: string): { url: string; format: "truetype" | "opentype" } | null {
  const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('(opentype|truetype)'\)/)
  if (!match) return null
  return { url: match[1].replace(/['"]/g, ""), format: match[2] as "truetype" | "opentype" }
}

async function loadWeight(weight: number, glyphs: string): Promise<EmbeddedFontFace> {
  const key = cacheKey(weight, glyphs)
  const hit = cache.get(key)
  if (hit) return hit

  const cssUrl =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(FONT_FAMILY)}:wght@${weight}` +
    `&text=${encodeURIComponent(glyphs)}`
  const cssRes = await fetch(cssUrl, { headers: { "User-Agent": LEGACY_SAFARI_UA } })
  if (!cssRes.ok) throw new Error(`Font CSS failed (${cssRes.status})`)
  const css = await cssRes.text()
  const parsed = parseFontUrl(css)
  if (!parsed) throw new Error("Noto Sans KR TTF/OTF source not found")

  const fileRes = await fetch(parsed.url)
  if (!fileRes.ok) throw new Error(`Font file failed (${fileRes.status})`)
  const data = await fileRes.arrayBuffer()
  const face: EmbeddedFontFace = {
    family: FONT_FAMILY,
    weight,
    data,
    format: parsed.format,
  }
  cache.set(key, face)
  return face
}

/** Subset Noto Sans KR for the card glyphs. Cached per weight + glyph set. */
export async function loadCardFonts(glyphs: string): Promise<EmbeddedFontFace[]> {
  const unique = [...new Set(glyphs)].join("")
  const faces = await Promise.all(WEIGHTS.map((weight) => loadWeight(weight, unique)))
  return faces
}
