# SurviveEnglish → Signal Field recommend map

Domain scoring for §1.5 of [`design.md`](./design.md). Score keywords in the brief; highest domain wins; break ties toward **clarity** and **one accent**.

## Domains

| Domain | Keywords (KO/EN) | Primary mix lean | Color | Type | Density | Research lean |
| --- | --- | --- | --- | --- | --- | --- |
| **Language learning** | english, vocab, tutor, study, 단어, 튜터, 학습, bilingual | calm study UI | `signal-teal` / soft-sage | plex / jakarta | default · comfortable | wcag+m3+fluid |
| **Capture / speech** | transcript, whisper, record, 녹음, 받아쓰기 | utility clarity | clear-ink or signal-teal | plex | default | a11y |
| **Commerce / export** | pdf, image card, share, 이미지, 카드 | warm export surfaces | kiln-copper (export only) | outfit-source | comfortable | polaris |
| **Admin / keys** | api keys, settings, 설정 | Clearline | clear-ink | plex | a11y-large | govuk |

## Default primary (SurviveEnglish product)

When the brief is the app itself (tutor · capture · words · study):

| Rank | Kit / mix | Why |
| --- | --- | --- |
| **1 Primary** | `precise-quiet` ≈ signal-teal · plex · default · wcag+m3 | Clarity for bilingual study; single teal signal; quiet chrome |
| **2 Alt** | `soft-product` ≈ soft-sage · jakarta · comfortable | Gentler consumer learning; softer radii |
| **3 Alt** | `day-editorial` ≈ day-mist · plex · comfortable | Reading-forward vocab / insights surfaces |

**Do not** recommend purple→indigo, cream+terracotta+display-serif, or broadsheet kits (§1.3).

## Current product mapping (as of restore)

| SurviveEnglish token | Signal Field role |
| --- | --- |
| `--primary` / aqua | `--color-signal` (keep one family) |
| `--foreground` | `--color-ink` |
| `--background` | `--color-field` |
| `--muted-foreground` | `--color-ink-soft` |
| `--destructive` | `--color-danger` |
| Pretendard (UI) | Prefer IBM Plex when adopting full kit; Pretendard OK for KO/EN until type option switches to `plex` |

Vocab card PNG palettes may stay multi-hue for **saved assets**; product chrome must stay one signal family.
