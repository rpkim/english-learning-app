"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2, HelpCircle, Languages, Sparkles, Mic, MicOff,
  BookmarkPlus, Check, ChevronRight, Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { VocabularyItem, TutorChatMessage } from "@/lib/types"
import type { LookupResult, MeaningResult, TranslateResult, NaturalizeResult } from "@/app/api/tutor-lookup/route"

// ── Web Speech API types (not in all TS libs) ──────────────────────────────
interface SpeechRecognitionResultItem { transcript: string; confidence: number }
interface SpeechRecognitionResult { readonly isFinal: boolean; readonly length: number; [index: number]: SpeechRecognitionResultItem }
interface SpeechRecognitionResultList { readonly length: number; [index: number]: SpeechRecognitionResult }
interface SpeechRecognitionEvent extends Event { readonly resultIndex: number; readonly results: SpeechRecognitionResultList }
interface ISpeechRecognition extends EventTarget {
  lang: string; interimResults: boolean; continuous: boolean
  start(): void; stop(): void; abort(): void
  onresult: ((ev: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
declare const SpeechRecognition: { new(): ISpeechRecognition } | undefined
declare const webkitSpeechRecognition: { new(): ISpeechRecognition } | undefined
// ───────────────────────────────────────────────────────────────────────────

type QuickKind = "meaning" | "translate" | "naturalize"

type AddVocabPayload = {
  word: string
  type: VocabularyItem["type"]
  definition?: string
  example_sentence?: string
  korean_translation?: string
  context?: string
}

const QUICK_TABS: {
  kind: QuickKind
  label: string
  icon: typeof HelpCircle
  placeholder: string
  multiline: boolean
}[] = [
  {
    kind: "meaning",
    label: "뜻이 뭐야?",
    icon: HelpCircle,
    placeholder: "예: out of the blue, leverage, hit the nail on the head…",
    multiline: false,
  },
  {
    kind: "translate",
    label: "번역해줘",
    icon: Languages,
    placeholder: "번역할 영어 문장을 입력…",
    multiline: true,
  },
  {
    kind: "naturalize",
    label: "더 자연스럽게",
    icon: Sparkles,
    placeholder: "다듬을 영어 문장을 입력…",
    multiline: true,
  },
]

const REGISTER_COLOR: Record<string, string> = {
  Formal: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Neutral: "bg-muted text-muted-foreground",
  Casual: "bg-green-500/10 text-green-600 dark:text-green-400",
  Slang: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  Business: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
}

export interface TutorChatPanelProps {
  transcriptContext: string
  className?: string
  onAddVocabularyItem?: (payload: AddVocabPayload) => void
  onSaveSession?: (messages: TutorChatMessage[]) => void
}

// ── Section label ──────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  )
}

// ── Card: meaning ──────────────────────────────────────────────────────────
function MeaningCard({ r }: { r: MeaningResult }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2 mb-4">
        <h2 className="text-2xl font-bold tracking-tight">{r.query}</h2>
        {r.register && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", REGISTER_COLOR[r.register] ?? REGISTER_COLOR.Neutral)}>
            {r.register}
          </span>
        )}
      </div>

      <div className="mb-4">
        <SectionLabel>의미</SectionLabel>
        <p className="text-[15px] leading-relaxed">{r.meaning}</p>
      </div>

      <div className="mb-4">
        <SectionLabel>뉘앙스</SectionLabel>
        <p className="text-sm leading-relaxed text-foreground/80">{r.nuance}</p>
      </div>

      {r.examples.length > 0 && (
        <div className="mb-4">
          <SectionLabel>예문</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {r.examples.map((ex, i) => (
              <div key={i} className="rounded-xl border-l-2 border-primary/40 bg-muted/50 px-3 py-2">
                <p className="text-sm font-medium">{ex.en}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{ex.ko}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {r.tips && (
        <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">💡 {r.tips}</p>
        </div>
      )}
    </>
  )
}

// ── Card: translate ────────────────────────────────────────────────────────
function TranslateCard({ r }: { r: TranslateResult }) {
  return (
    <>
      <div className="mb-4">
        <SectionLabel>원문</SectionLabel>
        <p className="text-[15px] leading-relaxed text-foreground/70 italic">"{r.query}"</p>
      </div>

      <div className="mb-4">
        <SectionLabel>번역</SectionLabel>
        <p className="text-xl font-semibold leading-relaxed">{r.translation}</p>
      </div>

      {r.literal && (
        <div className="mb-4">
          <SectionLabel>직역</SectionLabel>
          <p className="text-sm leading-relaxed text-foreground/70">{r.literal}</p>
        </div>
      )}

      {r.note && (
        <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-400">📌 {r.note}</p>
        </div>
      )}
    </>
  )
}

// ── Card: naturalize ───────────────────────────────────────────────────────
function NaturalizeCard({ r }: { r: NaturalizeResult }) {
  return (
    <>
      <div className="mb-4">
        <SectionLabel>원문</SectionLabel>
        <p className="text-sm leading-relaxed text-foreground/60 line-through">{r.query}</p>
      </div>

      <div className="mb-4">
        <SectionLabel>개선된 표현</SectionLabel>
        <p className="text-xl font-semibold leading-relaxed text-green-600 dark:text-green-400">{r.improved}</p>
      </div>

      {r.alternatives.length > 0 && (
        <div className="mb-4">
          <SectionLabel>다른 표현</SectionLabel>
          <div className="flex flex-col gap-2">
            {r.alternatives.map((alt, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
                <p className="text-sm font-medium">{alt.text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{alt.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionLabel>설명</SectionLabel>
        <p className="text-sm leading-relaxed text-foreground/80">{r.changes}</p>
      </div>
    </>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────
function LookupSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-5">
      <div className="h-7 w-1/3 rounded-lg bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-muted/70" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-4/5 rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-muted/70" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-muted/70" />
        <div className="h-14 w-full rounded-xl bg-muted" />
        <div className="h-14 w-full rounded-xl bg-muted" />
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ activeQuick }: { activeQuick: QuickKind }) {
  const messages: Record<QuickKind, { title: string; desc: string }> = {
    meaning: { title: "단어·표현 검색", desc: "알고 싶은 영어 단어나 표현을 입력하면\n뜻·뉘앙스·예문을 카드로 보여줄게요." },
    translate: { title: "번역", desc: "영어 문장을 입력하면\n자연스러운 한국어로 번역해드려요." },
    naturalize: { title: "표현 개선", desc: "영어 문장을 입력하면\n더 자연스러운 원어민 표현으로 다듬어줘요." },
  }
  const { title, desc } = messages[activeQuick]
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
        {activeQuick === "meaning" && <HelpCircle className="h-6 w-6 text-muted-foreground/60" />}
        {activeQuick === "translate" && <Languages className="h-6 w-6 text-muted-foreground/60" />}
        {activeQuick === "naturalize" && <Sparkles className="h-6 w-6 text-muted-foreground/60" />}
      </div>
      <div>
        <p className="font-semibold text-foreground/80">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{desc}</p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export function TutorChatPanel({ transcriptContext, className, onAddVocabularyItem, onSaveSession }: TutorChatPanelProps) {
  const [result, setResult] = useState<LookupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeQuick, setActiveQuick] = useState<QuickKind>("meaning")
  const [draft, setDraft] = useState("")
  const [savedFlash, setSavedFlash] = useState(false)
  const [isListening, setIsListening] = useState(false)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const sessionMessagesRef = useRef<TutorChatMessage[]>([])

  // Auto-save session on unmount
  useEffect(() => {
    return () => {
      if (sessionMessagesRef.current.length > 0) {
        onSaveSession?.(sessionMessagesRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectTab = (kind: QuickKind) => {
    setActiveQuick(kind)
    setDraft("")
    setResult(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const toggleMic = useCallback(() => {
    if (typeof window === "undefined") return
    const SR =
      (typeof SpeechRecognition !== "undefined" ? SpeechRecognition : undefined) ??
      (typeof webkitSpeechRecognition !== "undefined" ? webkitSpeechRecognition : undefined)

    if (!SR) { alert("이 브라우저는 음성 인식을 지원하지 않습니다."); return }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const rec = new SR()
    rec.lang = "en-US"
    rec.interimResults = true
    rec.continuous = false
    let finalText = ""

    rec.onresult = (event) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalText += t
        else interim = t
      }
      setDraft(finalText + interim)
    }
    rec.onend = () => { setIsListening(false); if (finalText) setDraft(finalText) }
    rec.onerror = () => { setIsListening(false) }

    recognitionRef.current = rec
    rec.start()
    setIsListening(true)
  }, [isListening])

  const submit = async () => {
    const text = draft.trim()
    if (!text || loading) return
    setLoading(true)
    setResult(null)
    setDraft("")
    recognitionRef.current?.stop()

    try {
      const res = await fetch("/api/tutor-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type: activeQuick }),
      })
      const data = (await res.json()) as LookupResult
      setResult(data)
      // Save to session history for History tab
      sessionMessagesRef.current = [
        ...sessionMessagesRef.current,
        { role: "user", content: text },
        { role: "assistant", content: JSON.stringify(data) },
      ]
    } catch {
      // silent fail — user can retry
    } finally {
      setLoading(false)
    }
  }

  const handlePass = () => {
    setResult(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleSave = () => {
    if (!result || !onAddVocabularyItem) return

    let payload: AddVocabPayload

    if (result.type === "meaning") {
      const r = result as import("@/app/api/tutor-lookup/route").MeaningResult
      const contextParts = [
        r.examples[1] ? `"${r.examples[1].en}" — ${r.examples[1].ko}` : null,
        r.register ? `Register: ${r.register}` : null,
        r.tips ?? null,
      ].filter(Boolean)
      payload = {
        word: r.query,
        type: "word",
        korean_translation: r.meaning,
        definition: r.nuance,
        example_sentence: r.examples[0] ? `${r.examples[0].en}` : undefined,
        context: contextParts.length
          ? [r.examples[0]?.ko, ...contextParts].filter(Boolean).join("\n")
          : r.examples[0]?.ko,
      }
    } else if (result.type === "translate") {
      const r = result as import("@/app/api/tutor-lookup/route").TranslateResult
      payload = {
        word: r.query,
        type: "expression",
        korean_translation: r.translation,
        definition: r.literal ?? undefined,
        context: r.note ?? undefined,
      }
    } else {
      const r = result as import("@/app/api/tutor-lookup/route").NaturalizeResult
      payload = {
        word: r.query,
        type: "expression",
        definition: r.improved,
        example_sentence: r.alternatives[0]?.text,
        context: [r.changes, r.alternatives.slice(1).map((a) => `• ${a.text} — ${a.note}`).join("\n")].filter(Boolean).join("\n\n"),
      }
    }

    onAddVocabularyItem(payload)
    setSavedFlash(true)
    setTimeout(() => {
      setSavedFlash(false)
      setResult(null)
      requestAnimationFrame(() => inputRef.current?.focus())
    }, 900)
  }

  const clearSession = () => {
    if (sessionMessagesRef.current.length > 0) onSaveSession?.(sessionMessagesRef.current)
    sessionMessagesRef.current = []
    setResult(null)
    setDraft("")
  }

  const activeTabMeta = QUICK_TABS.find((t) => t.kind === activeQuick)!

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>

      {/* ── Result / empty area ── */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4">
        {loading && <LookupSkeleton />}

        {!loading && !result && <EmptyState activeQuick={activeQuick} />}

        {!loading && result && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            {/* Card body */}
            <div className="p-4 sm:p-5">
              {result.type === "meaning" && <MeaningCard r={result as MeaningResult} />}
              {result.type === "translate" && <TranslateCard r={result as TranslateResult} />}
              {result.type === "naturalize" && <NaturalizeCard r={result as NaturalizeResult} />}
            </div>

            {/* Card actions */}
            <div className="flex items-center gap-2 border-t border-border/40 bg-muted/30 px-4 py-3">
              {savedFlash ? (
                <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" /> 단어장에 저장됐어요!
                </div>
              ) : (
                <>
                  {onAddVocabularyItem && (
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
                    >
                      <BookmarkPlus className="h-4 w-4" />
                      단어장에 저장
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePass}
                    className="flex items-center gap-1 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    패스
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {/* Session clear — only when history exists */}
              {sessionMessagesRef.current.length > 0 && !savedFlash && (
                <button
                  type="button"
                  onClick={clearSession}
                  className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  세션 초기화
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom input zone ── */}
      <div className="shrink-0 bg-background/95 px-3 pt-3 pb-3 backdrop-blur supports-backdrop-filter:bg-background/90 sm:px-4">

        {/* Quick prompt tab buttons */}
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {QUICK_TABS.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              disabled={loading}
              onClick={() => selectTab(kind)}
              className={cn(
                "flex shrink-0 h-8 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-all",
                activeQuick === kind
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Gemini-style pill input */}
        <div className={cn(
          "relative flex items-end gap-0 rounded-3xl border bg-card shadow-sm transition-all",
          isListening
            ? "border-red-400/60 ring-2 ring-red-400/20"
            : "border-border/60 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10"
        )}>
          {activeTabMeta.multiline ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isListening ? "🎤 듣는 중…" : activeTabMeta.placeholder}
              rows={1}
              disabled={loading}
              className="min-h-0 flex-1 resize-none border-0 bg-transparent px-4 py-3.5 text-[15px] leading-snug shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
              style={{ maxHeight: "9rem", overflowY: "auto" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit() }
                if (e.key === "Escape") { setDraft(""); recognitionRef.current?.stop() }
              }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = "auto"
                el.style.height = `${Math.min(el.scrollHeight, 144)}px`
              }}
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isListening ? "🎤 듣는 중…" : activeTabMeta.placeholder}
              disabled={loading}
              className="flex-1 border-0 bg-transparent px-4 py-3.5 text-[15px] shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50 h-auto"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void submit() }
                if (e.key === "Escape") { setDraft(""); recognitionRef.current?.stop() }
              }}
            />
          )}

          {/* Right-side buttons inside pill */}
          <div className="flex shrink-0 items-center gap-1 pr-2 pb-2">
            <button
              type="button"
              onClick={toggleMic}
              disabled={loading}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all",
                isListening
                  ? "animate-pulse bg-red-500/15 text-red-500"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={isListening ? "녹음 중지" : "음성으로 입력"}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <button
              type="button"
              disabled={!draft.trim() || loading}
              onClick={() => void submit()}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all",
                draft.trim() && !loading
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ChevronRight className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
