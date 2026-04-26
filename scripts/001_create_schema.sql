-- English Learning App Schema

-- Conversations table: stores transcription sessions
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled Session',
  transcript TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vocabulary items table: words and idioms extracted from conversations
CREATE TABLE IF NOT EXISTS public.vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  word TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'word', -- 'word' | 'idiom' | 'phrase'
  definition TEXT,
  example_sentence TEXT,
  korean_translation TEXT,
  context TEXT, -- the sentence from which it was extracted
  is_mastered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_vocabulary_conversation_id ON public.vocabulary(conversation_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_word ON public.vocabulary(word);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at DESC);

-- Enable RLS (open policies for single-user v1)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;

-- Open read/write policies (no auth required for v1 single-user)
DROP POLICY IF EXISTS "allow_all_conversations" ON public.conversations;
CREATE POLICY "allow_all_conversations" ON public.conversations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_vocabulary" ON public.vocabulary;
CREATE POLICY "allow_all_vocabulary" ON public.vocabulary FOR ALL USING (true) WITH CHECK (true);
