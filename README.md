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

# Required for REST / MCP (server-only; never expose to the browser)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: extra gate in front of the app
# APP_PASSWORD=some-password
```

Never commit API keys. `NEXT_PUBLIC_*` values ship to the browser; protect user data with Supabase RLS (see below).

### Database

In the Supabase SQL Editor, run:

1. [`supabase/schema.sql`](supabase/schema.sql) — tables, RLS policies
2. Any extra files under [`supabase/migrations/`](supabase/migrations/) that are not already in `schema.sql` (existing projects: run [`supabase/migrations/add_api_keys.sql`](supabase/migrations/add_api_keys.sql) for REST/MCP keys)

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
  api/               # App AI routes (Gemini, TTS, study, …)
  api/v1/            # REST API for agents (API key or session)
  api/mcp/           # MCP Streamable HTTP
  auth/callback/     # OAuth return
components/          # UI: tutor, vocabulary, study, capture, listen
hooks/               # TTS, transcription
lib/                 # Supabase client, types, i18n, DB helpers, vocab-card PNG
supabase/            # schema + migrations
electron/            # desktop shell
assets/fonts/        # Noto Sans KR for server-side card PNGs
```

App-internal AI helpers (browser `fetch("/api/…")`, need `GEMINI_API_KEY`):

| Route | Role |
| --- | --- |
| `/api/tutor-lookup` | Meaning / translate / naturalize (optional `context`) |
| `/api/extract` / `/api/extract-vocab` | Vocabulary from transcript or text |
| `/api/study-*` | Challenge, translate, story, upgrade, insights |
| `/api/tts` | Audio for word-listen mode |
| `/api/vocabulary-deep-dive` | Extra examples and etymology |
| `/api/organize-vocabulary` | AI collections |

---

## REST API and MCP

Agents (including MUSE), scripts, and other apps can read/write **your** vocabulary, conversations, and tutor lookups — including **card PNG download**.

This lived on branch `cursor/2026-06-02-6get-8c69f` and is restored here. If `/api/v1/*` returns 404 on a deployment, that build does not include this stack yet (redeploy this branch / merge to main).

Create a key in **Settings → API keys**. The plaintext value (`se_live_…`) is shown once; only a SHA-256 hash is stored.

Auth for `/api/v1/*` and `/api/mcp`:

```http
Authorization: Bearer se_live_…
```

Signed-in session cookies also work from the browser. CORS allows cross-origin REST/MCP calls. Data access uses the service role on the server and always filters by the key owner — do **not** put `SUPABASE_SERVICE_ROLE_KEY` in client code.

### REST v1

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1` | Discovery |
| `GET` | `/api/v1/me` | `{ user_id, via }` |
| `GET` `POST` | `/api/v1/keys` | List / create (session only) |
| `DELETE` | `/api/v1/keys/:id` | Revoke (session only) |
| `GET` `POST` | `/api/v1/vocabulary` | Query: `q`, `collection`, `type`, `mastered`, `limit`, `offset` |
| `GET` `PATCH` `DELETE` | `/api/v1/vocabulary/:id` | PATCH may include `add_sentence` |
| `GET` | `/api/v1/vocabulary/:id/image` | **1080×1350 PNG card** (`?format=png`). Auth required. |
| `GET` `POST` | `/api/v1/conversations` | |
| `GET` `PATCH` `DELETE` | `/api/v1/conversations/:id` | |
| `POST` | `/api/v1/tutor/lookup` | Body: `{ text, type, context?, targetLang? }` |

**Find “apples to apples” and download the card image**

```bash
# 1) Search
curl -s "https://YOUR_DOMAIN/api/v1/vocabulary?q=apples%20to%20apples" \
  -H "Authorization: Bearer se_live_…"

# 2) Download PNG (use an id from step 1)
curl -sS -o apples-to-apples.png \
  "https://YOUR_DOMAIN/api/v1/vocabulary/VOCAB_ID/image" \
  -H "Authorization: Bearer se_live_…"
```

In-app **이미지** button uses the same card layout ([`lib/vocab-card.ts`](lib/vocab-card.ts)) via browser canvas ([`lib/vocab-image.ts`](lib/vocab-image.ts)). The REST/MCP path renders PNG with `@resvg/resvg-js` ([`lib/vocab-card-png.ts`](lib/vocab-card-png.ts)).

### MCP

Yes — MCP is supported. Streamable HTTP JSON-RPC at **`POST /api/mcp`** (protocol `2025-03-26`). Cursor example (`mcp.json`):

```json
{
  "mcpServers": {
    "surviveenglish": {
      "url": "https://YOUR_DOMAIN/api/mcp",
      "headers": {
        "Authorization": "Bearer se_live_…"
      }
    }
  }
}
```

Tools: `list_vocabulary`, `get_vocabulary`, `get_vocabulary_image`, `add_vocabulary`, `update_vocabulary`, `delete_vocabulary`, `add_user_sentence`, `list_conversations`, `get_conversation`, `tutor_lookup`.

### Troubleshooting for MUSE / agents

1. `/api/v1/*` is **404** → this deployment is missing the REST stack; deploy a build that includes `app/api/v1`.
2. `/api/v1/*` is **401** → missing/invalid `Authorization: Bearer se_live_…` (create a key in Settings).
3. `/api/v1/*` is **503** about service role → set `SUPABASE_SERVICE_ROLE_KEY` on the host.
4. Image route works only with a **vocabulary id** (`/api/v1/vocabulary/:id/image`), not `/api/v1/…/image?word=…`.
5. App AI routes like `/api/tutor-lookup` still need `GEMINI_API_KEY`.

---

## Privacy and security

- User vocabulary, transcripts, and tutor history live in **your** Supabase project, not in this git repo.
- Server routes expect `GEMINI_API_KEY` on the host. If you deploy a public URL, treat those routes as a cost surface (rate limits / auth recommended).
- REST/MCP require `SUPABASE_SERVICE_ROLE_KEY` server-side only; API keys are hashed (`se_live_…` shown once).
- The listen-mode TTS proxy calls an upstream speech endpoint; it can fail or be blocked depending on network policy.

---

## License

Copyright (c) 2026 Jay. **All rights reserved.**

This software is **not** licensed under MIT, Apache, GPL, or any other open-source terms.

- Viewing this repository does **not** grant permission to use, copy, modify, fork, publish, or sell the software.
- You may not redistribute source or builds, use it commercially, or train models on this code without **prior written permission**.

Full terms: [LICENSE](LICENSE).

For permission, contact the repository owner.
