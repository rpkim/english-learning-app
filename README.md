# SurviveEnglish

An English-learning app for people who learn from **real speech**, not textbooks.

Capture conversations, extract vocabulary, ask a tutor what something means, then review with quizzes, listening drills, and writing practice. Progress syncs across devices with Google sign-in.

This repository is **not open source**. See [License](#license).

---

## What it does

SurviveEnglish is a four-tab workspace (mobile bottom nav, desktop split layout):

| Tab | Purpose |
| --- | --- |
| **Tutor** | Instant help: meaning, translation, more-natural rewrites |
| **Capture** | Live speech-to-text, then extract words from what you heard |
| **Words** | Personal vocabulary deck, search, filters, collections |
| **Study** | Quizzes, listening, writing, pattern analysis, stories |

UI copy is available in **Korean, English, Japanese, and Spanish**.

---

## Features

### Tutor

Three lookup modes, plus an optional **Context** field so answers match the situation (meeting, email, casual chat, and so on).

- **What does it mean?** — meaning, nuance, register, examples, tips
- **Translate** — natural translation, optional literal gloss, usage note
- **Make it natural** — rewrite, alternatives, explanation of what changed

You can save any result to the word list. Rephrase and translate cards keep their own layout (original / improved / explanation), not generic “definition / example” labels.

### Capture

- Record or transcribe English in the browser (local Whisper / speech models)
- Pull vocabulary out of a transcript with AI
- Keep session history in folders
- Optional Korean translations for captured items

### Words

- Deck and list views
- Search across the word, Korean meaning, definition, example, and context
- Filters: source (All / Session / Tutor), type (word / expression / rephrase), AI collections
- Hide mastered items
- **Saw it** review count (separate from marking complete)
- Extra examples and etymology (persisted)
- Personal sentences (“내 문장”) for lines you want to use later
- AI organize into collections
- PDF / image export

The filter toolbar **collapses** on mobile so cards get more screen space.

### Study

- **Word study** — memorize (meaning visible) or quiz (meaning hidden); optional “viewed only” quiz pool
- **Word listen** — pick a collection, repeat each **word** (default 3×) and **meaning** (default 1×), then auto-advance. Playback uses real audio so it can continue in the background / on the lock screen
- **Sentence challenge** — write a sentence with given words, AI scores it
- **Writing practice** — Korean → English with AI feedback
- **Pattern analysis** — insights from your vocab and tutor questions, with “learn next” suggestions
- **Expression upgrade** — make a sentence more natural
- **Story** — generate a story from saved words
- **My sentences** — all personal sentences in one list

---

## Tech stack

- **App:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Auth & data:** Supabase (Google OAuth, Postgres, Row Level Security)
- **AI:** Google Gemini (`gemini-2.5-flash` by default) for lookup, extract, study, translate
- **Speech:** browser Whisper / Transformers.js for capture; HTML audio + TTS proxy for listen mode
- **Desktop (optional):** Electron, macOS DMG via electron-builder

---

## Getting started

### Requirements

- Node.js 18+
- [pnpm](https://pnpm.io) (preferred) or npm
- A [Supabase](https://supabase.com) project
- A [Google Gemini](https://ai.google.dev/) API key
- Google OAuth configured on the Supabase project (for sign-in)

### Install

```bash
git clone https://github.com/rpkim/english-learning-app.git
cd english-learning-app
pnpm install
```

You need **written permission** from the copyright holder to clone this for your own use. Cloning without permission is not a license to run, modify, or redistribute the project.

### Environment

Create `.env.local` in the project root (this file is gitignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

GEMINI_API_KEY=your_gemini_api_key

# Optional: extra gate in front of the app
# APP_PASSWORD=some-password
```

Never commit API keys. `NEXT_PUBLIC_*` values ship to the browser; protect user data with Supabase RLS (see below).

### Database

In the Supabase SQL Editor, run:

1. [`supabase/schema.sql`](supabase/schema.sql) — tables, RLS policies
2. Any extra files under [`supabase/migrations/`](supabase/migrations/) that are not already in `schema.sql`

Policies are **per-user** (`auth.uid() = user_id`). Confirm they are enabled on the live project before using real data.

Also configure:

- Authentication → Google provider
- Redirect URL: `https://YOUR_DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback` for local dev)

### Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
pnpm build
pnpm start
```

### Desktop (macOS)

```bash
pnpm desktop:dev      # Next on :3010 + Electron
pnpm desktop:dist     # production DMG
```

---

## Project layout

```
app/                 # Next.js routes and API handlers
  api/               # Gemini, TTS, extract, study, translate, auth
  auth/callback/     # OAuth return
components/          # UI: tutor, vocabulary, study, capture, listen
hooks/               # TTS, transcription
lib/                 # Supabase client, types, i18n, DB helpers
supabase/            # schema + migrations
electron/            # desktop shell
```

Notable APIs:

| Route | Role |
| --- | --- |
| `/api/tutor-lookup` | Meaning / translate / naturalize (optional `context`) |
| `/api/extract` / `/api/extract-vocab` | Vocabulary from transcript or text |
| `/api/study-*` | Quiz-adjacent AI: challenge, translate, story, upgrade, insights |
| `/api/tts` | Audio for word-listen mode |
| `/api/vocabulary-deep-dive` | Extra examples and etymology |
| `/api/organize-vocabulary` | AI collections |

---

## Privacy and security

- User vocabulary, transcripts, and tutor history live in **your** Supabase project, not in this git repo.
- Server routes expect `GEMINI_API_KEY` on the host. If you deploy a public URL, treat those routes as a cost surface (rate limits / auth recommended).
- The listen-mode TTS proxy calls an upstream speech endpoint; it can fail or be blocked depending on network policy.

---

## License

Copyright (c) 2026 Jay. **All rights reserved.**

This software is **not** licensed under MIT, Apache, GPL, or any other open-source terms.

- Viewing this repository does **not** grant permission to use, copy, modify, fork, publish, or sell the software.
- You may not redistribute source or builds, use it commercially, or train models on this code without **prior written permission**.

Full terms: [LICENSE](LICENSE).

For permission, contact the repository owner.
