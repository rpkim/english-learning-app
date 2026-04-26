import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get("conversation_id")

  let query = supabase
    .from("vocabulary")
    .select("*")
    .order("created_at", { ascending: false })

  if (conversationId) {
    query = query.eq("conversation_id", conversationId)
  }

  const { data, error } = await query.limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { conversation_id, word, type, definition, example_sentence, korean_translation, context } = body

  const { data, error } = await supabase
    .from("vocabulary")
    .insert({ conversation_id, word, type, definition, example_sentence, korean_translation, context })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
