import { NextRequest, NextResponse } from "next/server"

const LANGS = new Set(["en", "ko", "ja", "es"])

export async function GET(req: NextRequest) {
  const text = (req.nextUrl.searchParams.get("text") ?? "").trim()
  const lang = (req.nextUrl.searchParams.get("lang") ?? "en").toLowerCase()

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 })
  }
  if (!LANGS.has(lang)) {
    return NextResponse.json({ error: "unsupported lang" }, { status: 400 })
  }

  const clipped = text.slice(0, 180)
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(clipped)}`

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
        Referer: "https://translate.google.com/",
      },
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: "tts upstream failed" }, { status: 502 })
    }

    const buf = await upstream.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json({ error: "tts request failed" }, { status: 502 })
  }
}
