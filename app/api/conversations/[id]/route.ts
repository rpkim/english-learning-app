import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { id } = await context.params
  const body = await request.json()
  const patch: { title?: string; transcript?: string } = {}
  if (typeof body?.title === "string" && body.title.trim()) {
    patch.title = body.title.trim()
  }
  if (typeof body?.transcript === "string") {
    patch.transcript = body.transcript
  }

  if (!patch.title && patch.transcript === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { id } = await context.params

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
