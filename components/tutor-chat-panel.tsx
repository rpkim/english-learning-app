"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  HelpCircle, Languages, Sparkles, Mic, MicOff,
  BookmarkPlus, Check, ChevronRight, Trash2, Volume2, VolumeX,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { VocabularyItem, TutorChatMessage } from "@/lib/types"
import type { LookupResult, MeaningResult, TranslateResult, NaturalizeResult } from "@/app/api/tutor-lookup/route"
import { useTts } from "@/hooks/use-tts"
import { useLocale } from "@/lib/locale-context"

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

type QuickTab = { kind: QuickKind; label: string; icon: typeof HelpCircle; placeholder: string; multiline: boolean }

function buildQuickTabs(s: ReturnType<typeof import("@/lib/i18n").t>): QuickTab[] {
  return [
    { kind: "meaning", label: s.tutor.meaningLabel, icon: HelpCircle, placeholder: s.tutor.meaningPlaceholder, multiline: false },
    { kind: "translate", label: s.tutor.translateLabel, icon: Languages, placeholder: s.tutor.translatePlaceholder, multiline: true },
    { kind: "naturalize", label: s.tutor.naturalizeLabel, icon: Sparkles, placeholder: s.tutor.naturalizePlaceholder, multiline: true },
  ]
}

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

// ── TTS button ─────────────────────────────────────────────────────────────
function TtsBtn({ text, speak, speakingText, size = "sm" }: {
  text: string
  speak: (t: string) => void
  speakingText: string | null
  size?: "sm" | "md"
}) {
  const isPlaying = speakingText === text
  return (
    <button
      type="button"
      onClick={() => speak(text)}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border transition-all",
        size === "sm" ? "h-6 w-6" : "h-7 w-7",
        isPlaying
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
      )}
      title={isPlaying ? "정지" : "읽기"}
    >
      {isPlaying
        ? <VolumeX className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
        : <Volume2 className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
    </button>
  )
}

// ── Card: meaning ──────────────────────────────────────────────────────────
function MeaningCard({ r, speak, speakingText }: { r: MeaningResult; speak: (t: string) => void; speakingText: string | null }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h2 className="text-2xl font-bold tracking-tight">{r.query}</h2>
        <TtsBtn text={r.query} speak={speak} speakingText={speakingText} size="md" />
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
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm font-medium">{ex.en}</p>
                  <TtsBtn text={ex.en} speak={speak} speakingText={speakingText} />
                </div>
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
function TranslateCard({ r, speak, speakingText }: { r: TranslateResult; speak: (t: string) => void; speakingText: string | null }) {
  return (
    <>
      <div className="mb-4">
        <SectionLabel>원문</SectionLabel>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-[15px] leading-relaxed text-foreground/70 italic">"{r.query}"</p>
          <TtsBtn text={r.query} speak={speak} speakingText={speakingText} size="md" />
        </div>
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
function NaturalizeCard({ r, speak, speakingText }: { r: NaturalizeResult; speak: (t: string) => void; speakingText: string | null }) {
  return (
    <>
      <div className="mb-4">
        <SectionLabel>원문</SectionLabel>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm leading-relaxed text-foreground/60 line-through">{r.query}</p>
          <TtsBtn text={r.query} speak={speak} speakingText={speakingText} />
        </div>
      </div>

      <div className="mb-4">
        <SectionLabel>개선된 표현</SectionLabel>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xl font-semibold leading-relaxed text-green-600 dark:text-green-400">{r.improved}</p>
          <TtsBtn text={r.improved} speak={speak} speakingText={speakingText} size="md" />
        </div>
      </div>

      {r.alternatives.length > 0 && (
        <div className="mb-4">
          <SectionLabel>다른 표현</SectionLabel>
          <div className="flex flex-col gap-2">
            {r.alternatives.map((alt, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm font-medium">{alt.text}</p>
                  <TtsBtn text={alt.text} speak={speak} speakingText={speakingText} />
                </div>
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
  const { strings } = useLocale()
  const messages: Record<QuickKind, { title: string; desc: string }> = {
    meaning: { title: strings.tutor.meaningLabel, desc: strings.tutor.emptyMeaning },
    translate: { title: strings.tutor.translateLabel, desc: strings.tutor.emptyTranslate },
    naturalize: { title: strings.tutor.naturalizeLabel, desc: strings.tutor.emptyNaturalize },
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

// ── Queue item ─────────────────────────────────────────────────────────────
type QueueItem = {
  id: string
  query: string
  kind: QuickKind
  status: "loading" | "done" | "error"
  result?: LookupResult
  savedFlash?: boolean
}

function makePayload(result: LookupResult): AddVocabPayload {
  if (result.type === "meaning") {
    const r = result as import("@/app/api/tutor-lookup/route").MeaningResult
    const contextParts = [
      r.examples[1] ? `"${r.examples[1].en}" — ${r.examples[1].ko}` : null,
      r.register ? `Register: ${r.register}` : null,
      r.tips ?? null,
    ].filter(Boolean)
    return {
      word: r.query, type: "word",
      korean_translation: r.meaning,
      definition: r.nuance,
      example_sentence: r.examples[0]?.en,
      context: contextParts.length ? [r.examples[0]?.ko, ...contextParts].filter(Boolean).join("\n") : r.examples[0]?.ko,
    }
  } else if (result.type === "translate") {
    const r = result as import("@/app/api/tutor-lookup/route").TranslateResult
    return {
      word: r.query,
      type: "translate",
      korean_translation: r.translation,
      definition: r.literal ?? undefined,
      context: r.note ?? undefined,
    }
  } else {
    const r = result as import("@/app/api/tutor-lookup/route").NaturalizeResult
    const altBullets = r.alternatives
      .map((a) => `• ${a.text}${a.note ? ` — ${a.note}` : ""}`)
      .join("\n")
    return {
      word: r.query,
      type: "rephrase",
      definition: r.improved,
      korean_translation: r.changes,
      example_sentence: r.alternatives[0]?.text ?? undefined,
      context: altBullets || undefined,
    }
  }
}

// ── Main component ─────────────────────────────────────────────────────────
export function TutorChatPanel({ transcriptContext, className, onAddVocabularyItem, onSaveSession }: TutorChatPanelProps) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [activeQuick, setActiveQuick] = useState<QuickKind>("meaning")
  const [draft, setDraft] = useState("")
  const [isListening, setIsListening] = useState(false)
  const { speak, speakingText } = useTts()
  const { locale, strings } = useLocale()
  const QUICK_TABS = buildQuickTabs(strings)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const sessionMessagesRef = useRef<TutorChatMessage[]>([])
  const feedRef = useRef<HTMLDivElement>(null)

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

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    const id = crypto.randomUUID()
    const kind = activeQuick
    setDraft("")
    recognitionRef.current?.stop()
    // Add loading item at top of feed
    setItems((prev) => [{ id, query: text, kind, status: "loading" }, ...prev])
    // Scroll feed to top
    requestAnimationFrame(() => feedRef.current?.scrollTo({ top: 0, behavior: "smooth" }))
    // Background fetch — doesn't block input
    void (async () => {
      try {
        const res = await fetch("/api/tutor-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, type: kind, targetLang: locale }),
        })
        const data = (await res.json()) as LookupResult
        setItems((prev) => prev.map((it) => it.id === id ? { ...it, status: "done", result: data } : it))
        sessionMessagesRef.current = [
          ...sessionMessagesRef.current,
          { role: "user", content: text },
          { role: "assistant", content: JSON.stringify(data) },
        ]
      } catch {
        setItems((prev) => prev.map((it) => it.id === id ? { ...it, status: "error" } : it))
      }
    })()
  }

  const handlePass = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const handleSave = (item: QueueItem) => {
    if (!item.result || !onAddVocabularyItem) return
    onAddVocabularyItem(makePayload(item.result))
    setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, savedFlash: true } : it))
    setTimeout(() => {
      setItems((prev) => prev.filter((it) => it.id !== item.id))
    }, 900)
  }

  const clearSession = () => {
    if (sessionMessagesRef.current.length > 0) onSaveSession?.(sessionMessagesRef.current)
    sessionMessagesRef.current = []
    setItems([])
    setDraft("")
  }

  const activeTabMeta = QUICK_TABS.find((t) => t.kind === activeQuick)!

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>

      {/* ── Feed area ── */}
      <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4">
        {items.length === 0 && <EmptyState activeQuick={activeQuick} />}

        {items.length > 0 && (
          <div className="flex flex-col gap-3">
            {/* Clear all */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearSession}
                className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                {strings.tutor.clearAll}
              </button>
            </div>

            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                {item.status === "loading" && <LookupSkeleton />}

                {item.status === "error" && (
                  <div className="flex items-center gap-2 p-4 text-sm text-destructive">
                    검색 실패 — 다시 시도해 주세요.
                    <button
                      type="button"
                      onClick={() => handlePass(item.id)}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                    >
                      닫기
                    </button>
                  </div>
                )}

                {item.status === "done" && item.result && (
                  <>
                    {/* Card body */}
                    <div className="p-4 sm:p-5">
                      {item.result.type === "meaning" && <MeaningCard r={item.result as MeaningResult} speak={speak} speakingText={speakingText} />}
                      {item.result.type === "translate" && <TranslateCard r={item.result as TranslateResult} speak={speak} speakingText={speakingText} />}
                      {item.result.type === "naturalize" && <NaturalizeCard r={item.result as NaturalizeResult} speak={speak} speakingText={speakingText} />}
                    </div>

                    {/* Card actions */}
                    <div className="flex items-center gap-2 border-t border-border/40 bg-muted/30 px-4 py-3">
                      {item.savedFlash ? (
                        <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
                          <Check className="h-4 w-4" /> {strings.tutor.save}!
                        </div>
                      ) : (
                        <>
                          {onAddVocabularyItem && (
                            <button
                              type="button"
                              onClick={() => handleSave(item)}
                              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
                            >
                              <BookmarkPlus className="h-4 w-4" />
                              {strings.tutor.save}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePass(item.id)}
                            className="flex items-center gap-1 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            {strings.tutor.pass}
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
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
              className="min-h-0 flex-1 resize-none border-0 bg-transparent px-4 py-3.5 text-[15px] leading-snug shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
              style={{ maxHeight: "9rem", overflowY: "auto" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() }
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
              className="flex-1 border-0 bg-transparent px-4 py-3.5 text-[15px] shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50 h-auto"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); submit() }
                if (e.key === "Escape") { setDraft(""); recognitionRef.current?.stop() }
              }}
            />
          )}

          {/* Right-side buttons inside pill */}
          <div className="flex shrink-0 items-center gap-1 pr-2 pb-2">
            <button
              type="button"
              onClick={toggleMic}
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
              disabled={!draft.trim()}
              onClick={() => submit()}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all",
                draft.trim()
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
