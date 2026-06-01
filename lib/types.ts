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
  type: "word" | "idiom" | "slang" | "phrasal_verb" | "expression" | "rephrase"
  source?: "session" | "tutor" | "manual"
  collection?: string | null
  definition: string | null
  example_sentence: string | null
  korean_translation: string | null
  context: string | null
  is_mastered: boolean
  view_count?: number
  extra_examples?: string[]
  etymology?: string | null
  related_forms?: string | null
  user_sentences?: UserSentence[]
  created_at: string
}

export interface UserSentence {
  id: string
  text: string
  created_at: string
}

export interface ExtractedItem {
  word: string
  type: "word" | "idiom" | "slang" | "phrasal_verb" | "expression"
  definition: string
  example_sentence: string
  context: string
}

export interface ConversationGroup {
  id: string
  name: string
  conversation_ids: string[]
  created_at: string
  archived_at?: string | null
}

export interface TutorChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface TutorSession {
  id: string
  title: string
  messages: TutorChatMessage[]
  created_at: string
}

export interface StudyResult {
  id: string
  type: "upgrade" | "story" | "insights"
  title: string
  content: Record<string, unknown>
  archived: boolean
  created_at: string
}
