import { getSupabaseAdmin } from "@/lib/supabase-admin"
import type { Conversation, UserSentence, VocabularyItem } from "@/lib/types"

type VocabRow = VocabularyItem & { user_id?: string }
type ConvRow = Conversation & { user_id?: string }

function stripVocab(row: VocabRow): VocabularyItem {
  const { user_id: _u, ...rest } = row
  return rest
}

function stripConv(row: ConvRow): Conversation {
  const { user_id: _u, ...rest } = row
  return rest
}

export async function listVocabulary(userId: string, opts: {
  q?: string
  collection?: string
  type?: string
  mastered?: boolean
  limit: number
  offset: number
}): Promise<{ items: VocabularyItem[]; total: number }> {
  const admin = getSupabaseAdmin()
  let query = admin
    .from("vocabulary_items")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)

  if (opts.collection) query = query.eq("collection", opts.collection)
  if (opts.type && opts.type !== "all") query = query.eq("type", opts.type)
  if (typeof opts.mastered === "boolean") query = query.eq("is_mastered", opts.mastered)
  if (opts.q) {
    const q = `%${opts.q}%`
    query = query.or(`word.ilike.${q},definition.ilike.${q},example_sentence.ilike.${q},context.ilike.${q},korean_translation.ilike.${q}`)
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { items: (data ?? []).map((r) => stripVocab(r as VocabRow)), total: count ?? 0 }
}

export async function getVocabulary(userId: string, id: string): Promise<VocabularyItem | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from("vocabulary_items")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? stripVocab(data as VocabRow) : null
}

export async function createVocabulary(
  userId: string,
  item: Partial<VocabularyItem> & { word: string },
): Promise<VocabularyItem> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from("vocabulary_items")
    .insert({
      user_id: userId,
      word: item.word.trim(),
      type: item.type ?? "word",
      source: item.source ?? "manual",
      collection: item.collection ?? null,
      definition: item.definition ?? null,
      example_sentence: item.example_sentence ?? null,
      korean_translation: item.korean_translation ?? null,
      context: item.context ?? null,
      is_mastered: item.is_mastered ?? false,
      conversation_id: item.conversation_id ?? null,
      extra_examples: item.extra_examples ?? [],
      etymology: item.etymology ?? null,
      related_forms: item.related_forms ?? null,
      user_sentences: item.user_sentences ?? [],
      view_count: item.view_count ?? 0,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return stripVocab(data as VocabRow)
}

export async function updateVocabulary(
  userId: string,
  id: string,
  fields: Partial<VocabularyItem>,
): Promise<VocabularyItem> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from("vocabulary_items")
    .update(fields)
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return stripVocab(data as VocabRow)
}

export async function deleteVocabulary(userId: string, id: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from("vocabulary_items")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function addUserSentence(userId: string, id: string, text: string): Promise<VocabularyItem> {
  const item = await getVocabulary(userId, id)
  if (!item) throw new Error("not found")
  const entry: UserSentence = {
    id: crypto.randomUUID(),
    text: text.trim(),
    created_at: new Date().toISOString(),
  }
  return updateVocabulary(userId, id, { user_sentences: [entry, ...(item.user_sentences ?? [])] })
}

export async function listConversations(userId: string, opts: { limit: number; offset: number }): Promise<{ items: Conversation[]; total: number }> {
  const admin = getSupabaseAdmin()
  const { data, error, count } = await admin
    .from("conversations")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)
  if (error) throw new Error(error.message)
  return { items: (data ?? []).map((r) => stripConv(r as ConvRow)), total: count ?? 0 }
}

export async function getConversation(userId: string, id: string): Promise<Conversation | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? stripConv(data as ConvRow) : null
}

export async function createConversation(
  userId: string,
  input: { title: string; transcript?: string; duration_seconds?: number },
): Promise<Conversation> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from("conversations")
    .insert({
      user_id: userId,
      title: input.title.trim(),
      transcript: input.transcript ?? "",
      duration_seconds: input.duration_seconds ?? 0,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return stripConv(data as ConvRow)
}

export async function updateConversation(
  userId: string,
  id: string,
  fields: Partial<Pick<Conversation, "title" | "transcript" | "duration_seconds">>,
): Promise<Conversation> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from("conversations")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return stripConv(data as ConvRow)
}

export async function deleteConversation(userId: string, id: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from("conversations")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}
