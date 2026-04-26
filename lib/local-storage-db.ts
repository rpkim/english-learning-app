/**
 * Client-side localStorage database — mirrors the Supabase schema.
 * Used when storageMode === "local".
 */
import { Conversation, ConversationGroup, VocabularyItem } from "@/lib/types"

const CONV_KEY = "englishlens_conversations"
const VOCAB_KEY = "englishlens_vocabulary"
const GROUP_KEY = "englishlens_conversation_groups"

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

export function localUpdateConversationTitle(id: string, title: string): Conversation | null {
  const items = localGetConversations()
  const idx = items.findIndex((c) => c.id === id)
  if (idx === -1) return null
  const trimmed = title.trim()
  if (!trimmed) return null
  items[idx] = {
    ...items[idx],
    title: trimmed,
    updated_at: new Date().toISOString(),
  }
  localStorage.setItem(CONV_KEY, JSON.stringify(items))
  return items[idx]
}

export function localUpdateConversationTranscript(id: string, transcript: string): Conversation | null {
  const items = localGetConversations()
  const idx = items.findIndex((c) => c.id === id)
  if (idx === -1) return null
  items[idx] = {
    ...items[idx],
    transcript,
    updated_at: new Date().toISOString(),
  }
  localStorage.setItem(CONV_KEY, JSON.stringify(items))
  return items[idx]
}

export function localDeleteConversation(id: string): void {
  const conversations = localGetConversations().filter((c) => c.id !== id)
  localStorage.setItem(CONV_KEY, JSON.stringify(conversations))

  // Also delete vocabulary linked to this session.
  const vocabulary = localGetVocabulary().filter((v) => v.conversation_id !== id)
  localStorage.setItem(VOCAB_KEY, JSON.stringify(vocabulary))

  // Remove deleted conversation from groups.
  const groups = localGetConversationGroups()
    .map((g) => ({
      ...g,
      conversation_ids: g.conversation_ids.filter((cid) => cid !== id),
    }))
    .filter((g) => g.conversation_ids.length > 0)
  localStorage.setItem(GROUP_KEY, JSON.stringify(groups))
}

export function localGetConversationGroups(): ConversationGroup[] {
  try {
    const raw = localStorage.getItem(GROUP_KEY)
    if (!raw) return []
    const items: ConversationGroup[] = JSON.parse(raw)
    return items
      .map((g) => ({ ...g, archived_at: g.archived_at ?? null }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } catch {
    return []
  }
}

export function localCreateConversationGroup(name: string, conversationIds: string[]): ConversationGroup {
  const group: ConversationGroup = {
    id: genId(),
    name: name.trim(),
    conversation_ids: Array.from(new Set(conversationIds)),
    created_at: new Date().toISOString(),
    archived_at: null,
  }
  const existing = localGetConversationGroups()
  localStorage.setItem(GROUP_KEY, JSON.stringify([group, ...existing]))
  return group
}

export function localDeleteConversationGroup(id: string): void {
  const groups = localGetConversationGroups().filter((g) => g.id !== id)
  localStorage.setItem(GROUP_KEY, JSON.stringify(groups))
}

export function localUpdateConversationGroupName(id: string, name: string): ConversationGroup | null {
  const groups = localGetConversationGroups()
  const idx = groups.findIndex((g) => g.id === id)
  if (idx === -1) return null
  const trimmed = name.trim()
  if (!trimmed) return null
  groups[idx] = { ...groups[idx], name: trimmed }
  localStorage.setItem(GROUP_KEY, JSON.stringify(groups))
  return groups[idx]
}

export function localMoveConversationToGroup(conversationId: string, targetGroupId: string | null): ConversationGroup[] {
  const groups = localGetConversationGroups().map((g) => {
    const filtered = g.conversation_ids.filter((cid) => cid !== conversationId)
    if (targetGroupId && g.id === targetGroupId) {
      return { ...g, conversation_ids: [...filtered, conversationId] }
    }
    return { ...g, conversation_ids: filtered }
  })
  localStorage.setItem(GROUP_KEY, JSON.stringify(groups))
  return groups
}

export function localArchiveConversationGroup(id: string): ConversationGroup | null {
  const groups = localGetConversationGroups()
  const idx = groups.findIndex((g) => g.id === id)
  if (idx === -1) return null
  groups[idx] = { ...groups[idx], archived_at: new Date().toISOString() }
  localStorage.setItem(GROUP_KEY, JSON.stringify(groups))
  return groups[idx]
}

export function localRestoreConversationGroup(id: string): ConversationGroup | null {
  const groups = localGetConversationGroups()
  const idx = groups.findIndex((g) => g.id === id)
  if (idx === -1) return null
  groups[idx] = { ...groups[idx], archived_at: null }
  localStorage.setItem(GROUP_KEY, JSON.stringify(groups))
  return groups[idx]
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
