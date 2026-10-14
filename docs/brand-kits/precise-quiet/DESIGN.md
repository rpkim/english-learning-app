# SurviveEnglish · precise-quiet

| Item | Value |
| --- | --- |
| Product | SurviveEnglish |
| Mix | `precise-quiet` |
| Status | Applied in app tokens (`app/globals.css`, `app/layout.tsx`) |
| Guideline | [`docs/design.md`](../../design.md) |
| Recommend | [`docs/recommend-map.md`](../../recommend-map.md) |

## Mix citation

| Axis | Option id | Notes |
| --- | --- | --- |
| Color | signal-teal / `signal` | `--color-signal: #129a90` family only |
| Type | plex | IBM Plex Sans + Mono; Pretendard fallback for Hangul |
| Density | default | `--radius-md: 0.75rem`; 8pt spacing tokens |
| Research | wcag+m3+fluid | focus-visible, reduced-motion, scroll-padding |
| References | ibm (lean) | Quiet chrome, one accent |

## Adapter map

| Signal Field | App token |
| --- | --- |
| `--color-ink` | `--foreground` |
| `--color-field` | `--background` |
| `--color-signal` | `--primary` |
| `--color-danger` | `--destructive` |
| `--color-ok` | `--success` |

Vocab card PNG palettes remain multi-hue for saved assets; product chrome uses one signal family.
