import { existsSync } from "node:fs"
import { join } from "node:path"

/** Internal family name of the bundled Noto Sans KR TTFs. */
export const CARD_FONT_FAMILY = "Noto Sans KR"

const REGULAR = "assets/fonts/NotoSansKR-Regular.ttf"
const BOLD = "assets/fonts/NotoSansKR-Bold.ttf"

function pairAt(root: string): [string, string] {
  return [join(root, REGULAR), join(root, BOLD)]
}

/**
 * Resolve bundled Noto Sans KR TTFs for @resvg/resvg-js.
 * resvg-js 2.6 reads fontFiles/fontDirs only — CSS @font-face data URIs are ignored.
 * Literal process.cwd() paths help Vercel file tracing include the TTFs.
 */
export function getCardFontFiles(): string[] {
  const candidates = [
    pairAt(process.cwd()),
    pairAt(join(process.cwd(), ".next/server")),
    pairAt(join(process.cwd(), ".next/standalone")),
  ]
  for (const files of candidates) {
    if (files.every((p) => existsSync(p))) return files
  }
  throw new Error(
    `Vocab card fonts missing (${REGULAR}, ${BOLD}). Tried: ${candidates.map((p) => p[0]).join(", ")}`,
  )
}
