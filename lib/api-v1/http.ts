import { NextResponse } from "next/server"

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cross-Origin-Resource-Policy": "cross-origin",
  }
}

export function jsonV1(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders() })
}

export function optionsV1() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export function errorV1(message: string, status: number) {
  return jsonV1({ error: message }, status)
}

export function pngV1(body: Uint8Array, filename: string) {
  const safe = filename.replace(/[\r\n"]/g, "") || "vocabulary.png"
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_") || "vocabulary.png"
  const encoded = encodeURIComponent(safe)
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...corsHeaders(),
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  })
}
