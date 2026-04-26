export interface Conversation {
  id: string
  title: string
  transcript: string
  duration_seconds: number
  created_at: string
  updated_at: string
}

export interface VocabularyItem {
  id: string
  conversation_id: string | null
  word: string
  type: "word" | "idiom" | "phrasal_verb" | "expression"
  definition: string | null
  example_sentence: string | null
  korean_translation: string | null
  context: string | null
  is_mastered: boolean
  created_at: string
}

export interface ExtractedItem {
  word: string
  type: "word" | "idiom" | "phrasal_verb" | "expression"
  definition: string
  example_sentence: string
  context: string
}

export interface ConversationGroup {
  id: string
  name: string
  conversation_ids: string[]
  created_at: string
}
