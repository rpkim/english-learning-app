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
