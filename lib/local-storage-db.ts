/**
 * Client-side localStorage database — mirrors the Supabase schema.
 * Used when storageMode === "local".
 */
import { Conversation, VocabularyItem } from "@/lib/types"

const CONV_KEY = "englishlens_conversations"
const VOCAB_KEY = "englishlens_vocabulary"

function genId(): string {
  return crypto.randomUUID()
}

// ── Conversations ────────────────────────────────────────────

export function localGetConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONV_KEY)
    if (!raw) return []
    const items: Conversation[] = JSON.parse(raw)
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } catch {
    return []
  }
}

export function localCreateConversation(
  title: string,
  transcript: string,
  duration_seconds: number
): Conversation {
  const conv: Conversation = {
    id: genId(),
    title,
    transcript,
    duration_seconds,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const existing = localGetConversations()
  localStorage.setItem(CONV_KEY, JSON.stringify([conv, ...existing]))
  return conv
}

// ── Vocabulary ───────────────────────────────────────────────

export function localGetVocabulary(conversationId?: string): VocabularyItem[] {
  try {
    const raw = localStorage.getItem(VOCAB_KEY)
    if (!raw) return []
    const items: VocabularyItem[] = JSON.parse(raw)
    const sorted = items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (conversationId) return sorted.filter((v) => v.conversation_id === conversationId)
    return sorted
  } catch {
    return []
  }
}

export function localCreateVocabularyItem(
  item: Omit<VocabularyItem, "id" | "created_at" | "is_mastered">
): VocabularyItem {
  const vocab: VocabularyItem = {
    ...item,
    id: genId(),
    is_mastered: false,
    created_at: new Date().toISOString(),
  }
  const existing = localGetVocabulary()
  localStorage.setItem(VOCAB_KEY, JSON.stringify([vocab, ...existing]))
  return vocab
}

export function localUpdateVocabularyItem(
  id: string,
  patch: Partial<VocabularyItem>
): VocabularyItem | null {
  const items = localGetVocabulary()
  const idx = items.findIndex((v) => v.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...patch }
  localStorage.setItem(VOCAB_KEY, JSON.stringify(items))
  return items[idx]
}

export function localDeleteVocabularyItem(id: string): void {
  const items = localGetVocabulary()
  localStorage.setItem(VOCAB_KEY, JSON.stringify(items.filter((v) => v.id !== id)))
}
