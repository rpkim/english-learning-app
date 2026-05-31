/**
 * Supabase database layer — async equivalents of local-storage-db functions.
 * All functions require an authenticated user (RLS enforced server-side).
 */
import { getSupabaseClient } from "@/lib/supabase-client"
import type { Conversation, ConversationGroup, VocabularyItem, TutorSession, TutorChatMessage, StudyResult } from "@/lib/types"

// ── Conversations ──────────────────────────────────────────────────────────

export async function dbGetConversations(): Promise<Conversation[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from("conversations")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error("[db] conversations:", error.message, error.code); return [] }
  return (data ?? []) as Conversation[]
}

export async function dbCreateConversation(
  title: string,
  transcript: string,
  durationSeconds: number
): Promise<Conversation> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data, error } = await sb
    .from("conversations")
    .insert({ user_id: user.id, title, transcript, duration_seconds: durationSeconds })
    .select()
    .single()
  if (error) throw new Error(error.message ?? JSON.stringify(error))
  return data as Conversation
}

export async function dbUpdateConversation(
  id: string,
  fields: Partial<Pick<Conversation, "title" | "transcript" | "duration_seconds">>
): Promise<Conversation> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from("conversations")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(error.message ?? JSON.stringify(error))
  return data as Conversation
}

export async function dbDeleteConversation(id: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.from("conversations").delete().eq("id", id)
  if (error) throw new Error(error.message ?? JSON.stringify(error))
}

// ── Conversation Groups ────────────────────────────────────────────────────

export async function dbGetConversationGroups(): Promise<ConversationGroup[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from("conversation_groups")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error("[db] conversation_groups:", error.message, error.code); return [] }
  return (data ?? []) as ConversationGroup[]
}

export async function dbCreateConversationGroup(name: string): Promise<ConversationGroup> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data, error } = await sb
    .from("conversation_groups")
    .insert({ user_id: user.id, name, conversation_ids: [] })
    .select()
    .single()
  if (error) throw new Error(error.message ?? JSON.stringify(error))
  return data as ConversationGroup
}

export async function dbUpdateConversationGroup(
  id: string,
  fields: Partial<Pick<ConversationGroup, "name" | "conversation_ids" | "archived_at">>
): Promise<ConversationGroup> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from("conversation_groups")
    .update(fields)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(error.message ?? JSON.stringify(error))
  return data as ConversationGroup
}

export async function dbMoveConversationToGroup(
  conversationId: string,
  groupId: string | null
): Promise<ConversationGroup[]> {
  const groups = await dbGetConversationGroups()
  // Remove from any group that has it
  await Promise.all(
    groups
      .filter((g) => g.conversation_ids.includes(conversationId))
      .map((g) =>
        dbUpdateConversationGroup(g.id, {
          conversation_ids: g.conversation_ids.filter((id) => id !== conversationId),
        })
      )
  )
  // Add to target group
  if (groupId) {
    const target = groups.find((g) => g.id === groupId)
    if (target && !target.conversation_ids.includes(conversationId)) {
      await dbUpdateConversationGroup(groupId, {
        conversation_ids: [...target.conversation_ids, conversationId],
      })
    }
  }
  return dbGetConversationGroups()
}

export async function dbDeleteConversationGroup(id: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.from("conversation_groups").delete().eq("id", id)
  if (error) throw new Error(error.message ?? JSON.stringify(error))
}

// ── Vocabulary Items ───────────────────────────────────────────────────────

export async function dbGetVocabularyItems(): Promise<VocabularyItem[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from("vocabulary_items")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error("[db] vocabulary_items:", error.message, error.code); return [] }
  return (data ?? []) as VocabularyItem[]
}

export async function dbCreateVocabularyItem(
  item: Omit<VocabularyItem, "id" | "created_at">
): Promise<VocabularyItem> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data, error } = await sb
    .from("vocabulary_items")
    .insert({ ...item, user_id: user.id })
    .select()
    .single()
  if (error) throw new Error(error.message ?? JSON.stringify(error))
  return data as VocabularyItem
}

export async function dbGetVocabularyByConversation(conversationId: string): Promise<VocabularyItem[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from("vocabulary_items")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message ?? JSON.stringify(error))
  return (data ?? []) as VocabularyItem[]
}

export async function dbUpdateVocabularyItem(
  id: string,
  fields: Partial<VocabularyItem>
): Promise<VocabularyItem> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from("vocabulary_items")
    .update(fields)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(error.message ?? JSON.stringify(error))
  return data as VocabularyItem
}

export async function dbDeleteVocabularyItem(id: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.from("vocabulary_items").delete().eq("id", id)
  if (error) throw new Error(error.message ?? JSON.stringify(error))
}

// ── Tutor Sessions ─────────────────────────────────────────────────────────

export async function dbGetTutorSessions(): Promise<TutorSession[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from("tutor_sessions")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error("[db] tutor_sessions:", error.message, error.code); return [] }
  return (data ?? []) as TutorSession[]
}

export async function dbSaveTutorSession(messages: TutorChatMessage[]): Promise<TutorSession> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const firstUserMsg = messages.find((m) => m.role === "user")?.content ?? ""
  const title = firstUserMsg.slice(0, 60) || "Tutor 대화"

  const { data, error } = await sb
    .from("tutor_sessions")
    .insert({ user_id: user.id, title, messages })
    .select()
    .single()
  if (error) throw new Error(error.message ?? JSON.stringify(error))
  return data as TutorSession
}

export async function dbDeleteTutorSession(id: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.from("tutor_sessions").delete().eq("id", id)
  if (error) throw new Error(error.message ?? JSON.stringify(error))
}

// ── Study Results ───────────────────────────────────────────────────────────

export async function dbGetStudyResults(): Promise<{ items: StudyResult[]; tableMissing?: boolean }> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from("study_results")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) {
    console.error("[db] study_results:", error.message, error.code)
    return { items: [], tableMissing: error.code === "PGRST205" }
  }
  return { items: (data ?? []) as StudyResult[] }
}

export async function dbCreateStudyResult(
  type: "upgrade" | "story" | "insights",
  title: string,
  content: Record<string, unknown>
): Promise<StudyResult> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data, error } = await sb
    .from("study_results")
    .insert({ user_id: user.id, type, title, content, archived: false })
    .select()
    .single()
  if (error) throw new Error(error.message ?? JSON.stringify(error))
  return data as StudyResult
}

export async function dbUpdateStudyResult(
  id: string,
  fields: Partial<Pick<StudyResult, "archived">>
): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.from("study_results").update(fields).eq("id", id)
  if (error) throw new Error(error.message ?? JSON.stringify(error))
}

export async function dbDeleteStudyResult(id: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.from("study_results").delete().eq("id", id)
  if (error) throw new Error(error.message ?? JSON.stringify(error))
}

export interface SavedInsightsContent {
  result: {
    summary?: string
    level_estimate?: string
    patterns?: unknown[]
    weak_areas?: unknown[]
    recommendations?: unknown[]
    word_topics?: string[]
    next_words?: Array<{ word: string; ko: string; reason: string }>
  }
  excludeWords?: string[]
}

/** Latest saved pattern analysis snapshot (one per user). */
export async function dbGetLatestStudyInsight(): Promise<StudyResult | null> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from("study_results")
    .select("*")
    .eq("type", "insights")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    if (error.code === "PGRST205") return null
    console.error("[db] study insight:", error.message, error.code)
    return null
  }
  return (data as StudyResult) ?? null
}

/** Replace previous insights snapshot with a new one. */
export async function dbSaveStudyInsight(
  result: SavedInsightsContent["result"],
  excludeWords: string[],
): Promise<StudyResult> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await sb.from("study_results").delete().eq("user_id", user.id).eq("type", "insights")

  const level = typeof result.level_estimate === "string" ? result.level_estimate : ""
  const title = level ? `패턴 분석 · ${level}` : "패턴 분석"
  return dbCreateStudyResult("insights", title, { result, excludeWords })
}

// ── Vocabulary Collection Layout ────────────────────────────────────────────

export type CollectionLayoutItem = {
  name: string
  emoji: string
  description: string
  words: string[]
}

export async function dbGetCollectionLayout(): Promise<CollectionLayoutItem[] | null> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from("vocabulary_collections")
    .select("layout")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) { console.error("[db] vocabulary_collections:", error.message, error.code); return null }
  return (data?.layout ?? null) as CollectionLayoutItem[] | null
}

export async function dbSaveCollectionLayout(
  layout: CollectionLayoutItem[]
): Promise<void> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  // Upsert: delete old + insert new (single layout per user)
  await sb.from("vocabulary_collections").delete().eq("user_id", user.id)
  const { error } = await sb
    .from("vocabulary_collections")
    .insert({ user_id: user.id, layout })
  if (error) throw new Error(error.message ?? JSON.stringify(error))
}
