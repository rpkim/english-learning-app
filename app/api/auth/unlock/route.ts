import { NextResponse } from "next/server"

export async function GET() {
  const appPassword = process.env.APP_PASSWORD
  return NextResponse.json({ enabled: Boolean(appPassword) })
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json()
    const appPassword = process.env.APP_PASSWORD

    // If password is not configured, keep app usable.
    if (!appPassword) {
      return NextResponse.json({ ok: true, enabled: false })
    }

    if (typeof password !== "string") {
      return NextResponse.json({ ok: false, error: "Password is required" }, { status: 400 })
    }

    const ok = password === appPassword
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 })
    }

    return NextResponse.json({ ok: true, enabled: true })
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 })
  }
}
