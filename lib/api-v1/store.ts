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

/** PostgREST PGRST204 — live DB / schema cache is missing a column the client sent. */
function schemaCacheMissingColumn(message: string): string | null {
  return message.match(/Could not find the '([^']+)' column of 'vocabulary_items'/)?.[1] ?? null
}

const REQUIRED_VOCAB_WRITE_COLS = new Set(["user_id", "word", "type", "is_mastered"])

type VocabWrite = Record<string, unknown>

function isDroppableVocabColumn(col: string): boolean {
  return !REQUIRED_VOCAB_WRITE_COLS.has(col)
}

/**
 * Insert shape that matches the in-app UI (`dbCreateVocabularyItem` callers).
 * Never writes `collection` — live Postgres may not have that column (PGRST204).
 * Grouping lives in `vocabulary_collections` layout JSON.
 */
export function buildVocabularyInsert(
  userId: string,
  item: Partial<VocabularyItem> & { word: string },
): VocabWrite {
  const row: VocabWrite = {
    user_id: userId,
    word: item.word.trim(),
    type: item.type ?? "word",
    source: item.source ?? "manual",
    definition: item.definition ?? null,
    example_sentence: item.example_sentence ?? null,
    korean_translation: item.korean_translation ?? null,
    context: item.context ?? null,
    is_mastered: item.is_mastered ?? false,
    conversation_id: item.conversation_id ?? null,
  }
  if (item.extra_examples !== undefined) row.extra_examples = item.extra_examples
  if (item.etymology !== undefined) row.etymology = item.etymology
  if (item.related_forms !== undefined) row.related_forms = item.related_forms
  if (item.user_sentences !== undefined) row.user_sentences = item.user_sentences
  if (item.view_count !== undefined) row.view_count = item.view_count
  return row
}

const VOCAB_UPDATE_KEYS = new Set<keyof VocabularyItem>([
  "word",
  "type",
  "source",
  "definition",
  "example_sentence",
  "korean_translation",
  "context",
  "is_mastered",
  "conversation_id",
  "collection",
  "extra_examples",
  "etymology",
  "related_forms",
  "user_sentences",
  "view_count",
])

function pickVocabularyUpdate(fields: Partial<VocabularyItem>): VocabWrite {
  const patch: VocabWrite = {}
  for (const key of VOCAB_UPDATE_KEYS) {
    if (key in fields && fields[key] !== undefined) {
      patch[key] = fields[key]
    }
  }
  return patch
}

async function insertVocabRow(row: VocabWrite) {
  const admin = getSupabaseAdmin()
  const payload = { ...row }
  for (let i = 0; i < 12; i++) {
    const { data, error } = await admin.from("vocabulary_items").insert(payload).select().single()
    if (!error) return data
    const col = schemaCacheMissingColumn(error.message)
    if (col && col in payload && isDroppableVocabColumn(col)) {
      delete payload[col]
      continue
    }
    throw new Error(error.message)
  }
  throw new Error("Failed to create vocabulary")
}

async function updateVocabRow(userId: string, id: string, fields: VocabWrite) {
  const admin = getSupabaseAdmin()
  const payload = { ...fields }
  for (let i = 0; i < 12; i++) {
    if (Object.keys(payload).length === 0) return null
    const { data, error } = await admin
      .from("vocabulary_items")
      .update(payload)
      .eq("user_id", userId)
      .eq("id", id)
      .select()
      .single()
    if (!error) return data
    const col = schemaCacheMissingColumn(error.message)
    if (col && col in payload && isDroppableVocabColumn(col)) {
      delete payload[col]
      continue
    }
    throw new Error(error.message)
  }
  throw new Error("Failed to update vocabulary")
}

/** Matches Words-tab labels: `${emoji} ${name}` (see english-learning-app layout re-apply). */
const DEFAULT_COLLECTION_EMOJI = "📥"
const DEFAULT_COLLECTION_NAME = "Inbox"
const DEFAULT_COLLECTION_DESCRIPTION = "Ungrouped words"
const DEFAULT_COLLECTION_ALIASES = new Set(["inbox", "default", "미분류", "uncategorized"])

type CollectionLayoutItem = {
  name: string
  emoji: string
  description: string
  words: string[]
}

function collectionLabel(col: { emoji?: string; name?: string }): string {
  return `${col.emoji ?? ""} ${col.name ?? ""}`.trim()
}

function normalizeLayout(raw: unknown): CollectionLayoutItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((col) => {
    const item = col as Partial<CollectionLayoutItem>
    return {
      name: typeof item.name === "string" ? item.name : "",
      emoji: typeof item.emoji === "string" ? item.emoji : "",
      description: typeof item.description === "string" ? item.description : "",
      words: Array.isArray(item.words)
        ? item.words.filter((w): w is string => typeof w === "string" && w.trim().length > 0)
        : [],
    }
  })
}

function parseCollectionLabel(raw: string): { emoji: string; name: string } {
  const trimmed = raw.trim()
  const match = trimmed.match(/^(\p{Extended_Pictographic}\uFE0F?)\s+(.+)$/u)
  if (match) return { emoji: match[1], name: match[2].trim() }
  return { emoji: "📁", name: trimmed }
}

function isDefaultCollectionName(value: string): boolean {
  const needle = value.trim().toLowerCase()
  if (!needle) return true
  if (DEFAULT_COLLECTION_ALIASES.has(needle)) return true
  const parsed = parseCollectionLabel(value)
  return DEFAULT_COLLECTION_ALIASES.has(parsed.name.toLowerCase())
}

function findCollectionIndex(layout: CollectionLayoutItem[], requested: string): number {
  const needle = requested.trim().toLowerCase()
  if (!needle) return -1
  const byLabel = layout.findIndex((c) => collectionLabel(c).toLowerCase() === needle)
  if (byLabel >= 0) return byLabel
  return layout.findIndex((c) => (c.name ?? "").trim().toLowerCase() === needle)
}

function findDefaultCollectionIndex(layout: CollectionLayoutItem[]): number {
  return layout.findIndex((c) => {
    const name = (c.name ?? "").trim().toLowerCase()
    if (DEFAULT_COLLECTION_ALIASES.has(name)) return true
    const parsed = parseCollectionLabel(collectionLabel(c))
    return DEFAULT_COLLECTION_ALIASES.has(parsed.name.toLowerCase())
  })
}

async function loadCollectionLayout(
  userId: string,
): Promise<{ id: string | null; layout: CollectionLayoutItem[] }> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from("vocabulary_collections")
    .select("id, layout")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return { id: data?.id ?? null, layout: normalizeLayout(data?.layout) }
}

async function saveCollectionLayout(
  userId: string,
  id: string | null,
  layout: CollectionLayoutItem[],
): Promise<void> {
  const admin = getSupabaseAdmin()
  if (id) {
    const { error } = await admin.from("vocabulary_collections").update({ layout }).eq("id", id)
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await admin.from("vocabulary_collections").insert({ user_id: userId, layout })
  if (error) throw new Error(error.message)
}

/** Add `word` to the named collection (or 📥 Inbox). Same storage the Words tab reads. */
async function assignWordToCollection(
  userId: string,
  word: string,
  requested?: string,
): Promise<string> {
  const wordKey = word.trim()
  const wordLower = wordKey.toLowerCase()
  const requestedLabel = requested?.trim() ?? ""
  const useDefault = isDefaultCollectionName(requestedLabel)
  const { id, layout } = await loadCollectionLayout(userId)

  for (const col of layout) {
    col.words = col.words.filter((w) => w.toLowerCase() !== wordLower)
  }

  let idx = useDefault
    ? findDefaultCollectionIndex(layout)
    : findCollectionIndex(layout, requestedLabel)

  if (idx < 0) {
    const parsed = useDefault
      ? { emoji: DEFAULT_COLLECTION_EMOJI, name: DEFAULT_COLLECTION_NAME }
      : parseCollectionLabel(requestedLabel)
    layout.push({
      name: parsed.name,
      emoji: parsed.emoji,
      description: useDefault ? DEFAULT_COLLECTION_DESCRIPTION : "",
      words: [wordKey],
    })
    idx = layout.length - 1
  } else {
    layout[idx].words.push(wordKey)
  }

  await saveCollectionLayout(userId, id, layout)
  return collectionLabel(layout[idx])
}

async function getCollectionLabels(userId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { layout } = await loadCollectionLayout(userId)
    for (const col of layout) {
      const label = collectionLabel(col)
      if (!label) continue
      for (const w of col.words) {
        map.set(w.toLowerCase(), label)
      }
    }
  } catch {
    return map
  }
  return map
}

function overlayCollection(item: VocabularyItem, labels: Map<string, string>): VocabularyItem {
  if (item.collection) return item
  const label = labels.get(item.word.toLowerCase())
  return label ? { ...item, collection: label } : item
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
  const paginateInDb = !opts.collection

  let query = admin
    .from("vocabulary_items")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (opts.type && opts.type !== "all") query = query.eq("type", opts.type)
  if (typeof opts.mastered === "boolean") query = query.eq("is_mastered", opts.mastered)
  if (opts.q) {
    const q = `%${opts.q}%`
    query = query.or(`word.ilike.${q},definition.ilike.${q},example_sentence.ilike.${q},context.ilike.${q},korean_translation.ilike.${q}`)
  }
  query = paginateInDb
    ? query.range(opts.offset, opts.offset + opts.limit - 1)
    : query.range(0, 9999)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const labels = await getCollectionLabels(userId)
  let items = (data ?? []).map((r) => overlayCollection(stripVocab(r as VocabRow), labels))

  if (opts.collection) {
    items = items.filter((i) => i.collection === opts.collection)
    const total = items.length
    return { items: items.slice(opts.offset, opts.offset + opts.limit), total }
  }

  return { items, total: count ?? 0 }
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
  if (!data) return null
  const labels = await getCollectionLabels(userId)
  return overlayCollection(stripVocab(data as VocabRow), labels)
}

export async function createVocabulary(
  userId: string,
  item: Partial<VocabularyItem> & { word: string },
): Promise<VocabularyItem> {
  const data = await insertVocabRow(buildVocabularyInsert(userId, item))
  const created = stripVocab(data as VocabRow)
  const requested = typeof item.collection === "string" ? item.collection.trim() : ""
  try {
    const label = await assignWordToCollection(userId, created.word, requested || undefined)
    return { ...created, collection: label }
  } catch (e) {
    console.error("[api-v1] vocabulary_collections:", e)
    const labels = await getCollectionLabels(userId)
    const overlaid = overlayCollection(created, labels)
    return requested && !overlaid.collection ? { ...overlaid, collection: requested } : overlaid
  }
}

export async function updateVocabulary(
  userId: string,
  id: string,
  fields: Partial<VocabularyItem>,
): Promise<VocabularyItem> {
  const patch = pickVocabularyUpdate(fields)
  const requested = typeof fields.collection === "string" ? fields.collection.trim() : ""
  if ("collection" in patch) delete patch.collection
  const data = await updateVocabRow(userId, id, patch)
  let updated: VocabularyItem
  if (!data) {
    const current = await getVocabulary(userId, id)
    if (!current) throw new Error("not found")
    updated = current
  } else {
    updated = stripVocab(data as VocabRow)
  }
  if (requested) {
    try {
      const label = await assignWordToCollection(userId, updated.word, requested)
      return { ...updated, collection: label }
    } catch (e) {
      console.error("[api-v1] vocabulary_collections:", e)
      return { ...updated, collection: requested }
    }
  }
  const labels = await getCollectionLabels(userId)
  return overlayCollection(updated, labels)
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
