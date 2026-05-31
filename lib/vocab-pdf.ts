import type { jsPDF } from "jspdf"
import type { VocabularyItem } from "@/lib/types"

const PAGE_WIDTH_PX = 794
const PAGE_HEIGHT_PX = 1123 // A4 @ 96dpi — fixed render height for uniform pages
const ITEMS_PER_PAGE = 4

const TYPE_LABELS: Record<string, string> = {
  word: "Word",
  idiom: "Idiom",
  slang: "Slang",
  phrasal_verb: "Phrasal verb",
  expression: "Expression",
  rephrase: "Rephrase",
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

function buildCardHtml(item: VocabularyItem): string {
  const typeLabel = TYPE_LABELS[item.type] ?? item.type
  const word = escapeHtml(item.word)
  const korean = item.korean_translation ? escapeHtml(item.korean_translation) : ""
  const definition = item.definition ? escapeHtml(item.definition) : ""
  const example = item.example_sentence ? escapeHtml(item.example_sentence) : ""
  const context = item.context ? escapeHtml(item.context) : ""
  const collection = item.collection ? escapeHtml(item.collection) : ""

  return `
    <div class="card">
      <div class="card-head">
        <span class="word">${word}</span>
        <span class="badge type">${typeLabel}</span>
        ${item.is_mastered ? '<span class="badge mastered">✓ 완료</span>' : ""}
        ${collection ? `<span class="badge collection">${collection}</span>` : ""}
      </div>
      ${korean ? `<div class="meaning"><span class="label">뜻</span> ${korean}</div>` : ""}
      ${definition ? `<div class="definition">${definition}</div>` : ""}
      ${example ? `<div class="example">"${example}"</div>` : ""}
      ${context ? `<div class="context">${context}</div>` : ""}
    </div>
  `
}

function buildPageDocument(
  items: VocabularyItem[],
  page: number,
  totalPages: number,
  exportedAt: string,
  totalCount: number,
  isFirstPage: boolean,
): string {
  const cards = items.map(buildCardHtml).join("")
  const header = isFirstPage
    ? `<div class="header">
        <div class="title">생존 단어장</div>
        <div class="meta">${escapeHtml(exportedAt)} · ${totalCount}개 단어${totalPages > 1 ? ` · ${page}/${totalPages}페이지` : ""}</div>
      </div>`
    : ""

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: ${PAGE_WIDTH_PX}px;
      min-height: ${PAGE_HEIGHT_PX}px;
      background: #ffffff;
      color: #111827;
      font-family: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      font-size: 13px;
      line-height: 1.6;
      padding: 36px 40px 40px;
    }
    .header {
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
    }
    .title { font-size: 22px; font-weight: 700; color: #111827; }
    .meta { margin-top: 4px; font-size: 12px; color: #6b7280; }
    .card {
      margin-bottom: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 14px 16px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .word { font-size: 18px; font-weight: 700; color: #111827; }
    .badge {
      display: inline-block;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 500;
    }
    .badge.type { background: #f3f4f6; color: #6b7280; }
    .badge.mastered { background: #d1fae5; color: #065f46; }
    .badge.collection { background: #ede9fe; color: #5b21b6; }
    .meaning { margin-bottom: 4px; }
    .meaning .label { color: #6b7280; font-size: 11px; margin-right: 4px; }
    .meaning { font-weight: 600; }
    .definition { margin-bottom: 4px; color: #374151; }
    .example {
      margin-top: 6px;
      background: #f9fafb;
      border-left: 3px solid #6366f1;
      padding: 6px 10px;
      border-radius: 4px;
      font-style: italic;
      color: #4b5563;
    }
    .context { margin-top: 4px; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  ${header}
  ${cards}
</body>
</html>`
}

function createRenderIframe(): HTMLIFrameElement {
  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:794px",
    "height:1200px",
    "border:0",
    "opacity:0",
    "pointer-events:none",
    "z-index:-1",
  ].join(";")
  document.body.appendChild(iframe)
  return iframe
}

async function renderPageToCanvas(html: string): Promise<HTMLCanvasElement> {
  const iframe = createRenderIframe()
  try {
    const doc = iframe.contentDocument
    if (!doc) throw new Error("PDF render iframe unavailable")

    doc.open()
    doc.write(html)
    doc.close()

    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve()
      // Fallback if load event already fired
      setTimeout(resolve, 250)
    })

    if (doc.fonts?.ready) {
      await Promise.race([
        doc.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ])
    }

    const html2canvas = (await import("html2canvas")).default
    const body = doc.body
    const height = Math.max(body.scrollHeight, body.offsetHeight, PAGE_HEIGHT_PX)

    return await html2canvas(body, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      width: PAGE_WIDTH_PX,
      height,
      windowWidth: PAGE_WIDTH_PX,
      windowHeight: height,
      useCORS: true,
    })
  } finally {
    iframe.remove()
  }
}

/** Add canvas to PDF at full page width; slice vertically if content exceeds one page. */
function appendCanvasToPdf(
  doc: jsPDF,
  canvas: HTMLCanvasElement,
  pdfW: number,
  pdfH: number,
  addPageFirst: boolean,
): void {
  const scale = pdfW / canvas.width
  const maxSlicePx = Math.floor(pdfH / scale)
  let srcY = 0
  let needsNewPage = addPageFirst

  while (srcY < canvas.height) {
    const sliceH = Math.min(maxSlicePx, canvas.height - srcY)
    const pageCanvas = document.createElement("canvas")
    pageCanvas.width = canvas.width
    pageCanvas.height = sliceH
    pageCanvas.getContext("2d")!.drawImage(
      canvas, 0, srcY, canvas.width, sliceH,
      0, 0, canvas.width, sliceH,
    )

    if (needsNewPage) doc.addPage()
    needsNewPage = true

    doc.addImage(
      pageCanvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      pdfW,
      sliceH * scale,
    )
    srcY += sliceH
  }
}

export async function exportVocabularyPdf(items: VocabularyItem[]): Promise<void> {
  if (items.length === 0) throw new Error("No vocabulary items to export")

  const [{ jsPDF }] = await Promise.all([import("jspdf")])
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" })
  const pdfW = doc.internal.pageSize.getWidth()
  const pdfH = doc.internal.pageSize.getHeight()
  const exportedAt = new Date().toLocaleString()
  const pages = chunk(items, ITEMS_PER_PAGE)

  for (let i = 0; i < pages.length; i++) {
    const html = buildPageDocument(pages[i], i + 1, pages.length, exportedAt, items.length, i === 0)
    const canvas = await renderPageToCanvas(html)
    appendCanvasToPdf(doc, canvas, pdfW, pdfH, i > 0)
  }

  doc.save(`survive-vocab-${new Date().toISOString().slice(0, 10)}.pdf`)
}
