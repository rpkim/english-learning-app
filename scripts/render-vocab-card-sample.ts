import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { renderVocabCardPng } from "../lib/vocab-card-png"
import type { VocabularyItem } from "../lib/types"

const item: VocabularyItem = {
  id: "sample",
  conversation_id: null,
  word: "perseverance",
  type: "word",
  definition: "Persistence in doing something despite difficulty or delay in achieving success.",
  example_sentence: "Her perseverance through years of study paid off.",
  korean_translation: "인내, 끈기",
  context: "포기하지 않고 계속할 때 쓰는 말.",
  is_mastered: false,
  created_at: new Date().toISOString(),
}

async function main() {
  const png = await renderVocabCardPng(item)
  const out = process.argv[2] || join("/tmp", "vocab-card-sample.png")
  writeFileSync(out, png)
  console.log(`wrote ${out} (${png.length} bytes)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
