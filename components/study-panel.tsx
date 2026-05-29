"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import {
  Mic, MicOff, Sparkles, ArrowRight, BookOpen, ChevronDown, ChevronUp,
  Loader2, RotateCcw, Volume2, VolumeX, Check, Clock, Archive, Trash2,
  ChevronRight, Brain, Pencil, Trophy, Star, RefreshCw, Eye, EyeOff,
  ThumbsUp, ThumbsDown, X as XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { VocabularyItem } from "@/lib/types"
import type { UpgradeResult } from "@/app/api/study-upgrade/route"
import type { StoryResult } from "@/app/api/study-story/route"
import type { ChallengeResult, ChallengeWord } from "@/app/api/study-challenge/route"
import { useTts } from "@/hooks/use-tts"
import { useLocale } from "@/lib/locale-context"
import type { StudyResult } from "@/lib/types"
import { dbGetStudyResults, dbCreateStudyResult, dbUpdateStudyResult, dbDeleteStudyResult } from "@/lib/db"

// ── Web Speech API types ────────────────────────────────────────────────────
interface SpeechRecognitionResultItem { transcript: string }
interface SpeechRecognitionResult { readonly isFinal: boolean; readonly length: number; [index: number]: SpeechRecognitionResultItem }
interface SpeechRecognitionResultList { readonly length: number; [index: number]: SpeechRecognitionResult }
interface SpeechRecognitionEvent extends Event { readonly resultIndex: number; readonly results: SpeechRecognitionResultList }
interface ISpeechRecognition extends EventTarget {
  lang: string; interimResults: boolean; continuous: boolean
  start(): void; stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
declare const SpeechRecognition: new () => ISpeechRecognition
declare const webkitSpeechRecognition: new () => ISpeechRecognition

type StudyMode = "upgrade" | "story"
type StoryLength = "short" | "medium" | "long"

// ── TTS Button ──────────────────────────────────────────────────────────────
function TtsBtn({ text, speak, speakingText }: { text: string; speak: (t: string) => void; speakingText: string | null }) {
  const isPlaying = speakingText === text
  return (
    <button
      type="button"
      onClick={() => speak(text)}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border transition-all h-6 w-6",
        isPlaying
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
      )}
    >
      {isPlaying ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
    </button>
  )
}

// ── Highlight vocab words in text ───────────────────────────────────────────
function HighlightedText({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return <span>{text}</span>
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi")
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, i) =>
        words.some((w) => w.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="rounded bg-primary/15 px-0.5 font-semibold text-primary not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

// ── Section label ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{children}</p>
}

// ── Upgrade Mode ────────────────────────────────────────────────────────────
function UpgradeMode({
  vocabulary,
  onSave,
}: {
  vocabulary: VocabularyItem[]
  onSave?: (title: string, content: Record<string, unknown>) => void
}) {
  const [draft, setDraft] = useState("")
  const [result, setResult] = useState<UpgradeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [showChanges, setShowChanges] = useState(false)
  const [saved, setSaved] = useState(false)
  const { locale, strings } = useLocale()
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const { speak, speakingText } = useTts()

  const toggleMic = useCallback(() => {
    const SR =
      (typeof SpeechRecognition !== "undefined" ? SpeechRecognition : undefined) ??
      (typeof webkitSpeechRecognition !== "undefined" ? webkitSpeechRecognition : undefined)
    if (!SR) { alert("이 브라우저는 음성 인식을 지원하지 않습니다."); return }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return }
    const rec = new SR()
    rec.lang = "en-US"
    rec.interimResults = true
    rec.continuous = false
    let final = ""
    rec.onresult = (e) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim = e.results[i][0].transcript
      }
      setDraft(final + interim)
    }
    rec.onend = () => { setIsListening(false); if (final) setDraft(final) }
    rec.onerror = () => setIsListening(false)
    recognitionRef.current = rec
    rec.start()
    setIsListening(true)
  }, [isListening])

  const submit = async () => {
    if (!draft.trim() || loading) return
    setLoading(true)
    setResult(null)
    setShowChanges(false)
    try {
      const res = await fetch("/api/study-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentence: draft.trim(),
          targetLang: locale,
          vocabulary: vocabulary.slice(0, 80).map((v) => ({
            word: v.word, type: v.type, definition: v.definition, korean: v.korean_translation,
          })),
        }),
      })
      const data = await res.json() as UpgradeResult
      setResult(data)
      setSaved(false)
      onSave?.(
        `"${draft.trim().slice(0, 40)}"${draft.trim().length > 40 ? "…" : ""}`,
        data as unknown as Record<string, unknown>
      )
      setSaved(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="p-4">
          <SectionLabel>{strings.study.inputPlaceholder}</SectionLabel>
          <div className={cn(
            "relative flex items-end gap-0 rounded-xl border bg-muted/30 transition-all",
            isListening ? "border-red-400/60 ring-2 ring-red-400/20" : "border-border/40 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
          )}>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isListening ? "🎤 …" : strings.study.inputPlaceholder + " (e.g. I want to make my English better)"}
              rows={2}
              className="min-h-0 flex-1 resize-none border-0 bg-transparent px-4 py-3 text-[14px] leading-snug shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
              style={{ maxHeight: "8rem", overflowY: "auto" }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit() } }}
              onInput={(e) => {
                const el = e.currentTarget; el.style.height = "auto"
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`
              }}
            />
            <div className="flex shrink-0 items-center gap-1 pb-2 pr-2">
              <button type="button" onClick={toggleMic} className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                isListening ? "animate-pulse bg-red-500/15 text-red-500" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button type="button" disabled={!draft.trim() || loading} onClick={() => void submit()}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                  draft.trim() && !loading ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground"
                )}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/50">
            ⌘+Enter 전송 · 저장한 단어 {vocabulary.length}개 참고
          </p>
        </div>
      </div>

      {result && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {saved && (
            <div className="flex items-center gap-1.5 border-b border-border/40 bg-green-500/5 px-4 py-2 text-xs text-green-600 dark:text-green-400">
              <Check className="h-3 w-3" />
              자동 저장됨 — History에서 다시 볼 수 있어요
            </div>
          )}
          <div className="p-4 sm:p-5">
            {/* Before */}
            <div className="mb-4">
              <SectionLabel>{strings.study.original}</SectionLabel>
              <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/30">{result.original}</p>
            </div>

            {/* After */}
            <div className="mb-4">
              <SectionLabel>{strings.study.upgraded}</SectionLabel>
              <div className="flex items-start gap-2">
                <p className="flex-1 text-base font-semibold leading-snug">{result.improved}</p>
                <TtsBtn text={result.improved} speak={speak} speakingText={speakingText} />
              </div>
            </div>

            {/* Explanation */}
            <div className="mb-4 rounded-xl bg-muted/50 px-3 py-2.5">
              <p className="text-sm text-muted-foreground">{result.explanation}</p>
            </div>

            {/* Vocab words used */}
            {result.usedVocabWords?.length > 0 && (
              <div className="mb-4">
                <SectionLabel>{strings.study.vocabUsed}</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {result.usedVocabWords.map((w) => (
                    <span key={w} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Alternatives */}
            {result.alternatives?.length > 0 && (
              <div className="mb-4">
                <SectionLabel>{strings.study.otherVersions}</SectionLabel>
                <div className="flex flex-col gap-2">
                  {result.alternatives.map((alt, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl border-l-2 border-primary/30 bg-muted/40 px-3 py-2">
                      <div className="flex-1">
                        <p className="text-sm">{alt.text}</p>
                        <p className="text-[11px] text-muted-foreground">{alt.register}</p>
                      </div>
                      <TtsBtn text={alt.text} speak={speak} speakingText={speakingText} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Changes detail (collapsible) */}
            {result.changes?.length > 0 && (
              <button
                type="button"
                onClick={() => setShowChanges((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                {showChanges ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                변경 상세 {result.changes.length}개
              </button>
            )}
            {showChanges && result.changes?.map((c, i) => (
              <div key={i} className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="line-through opacity-60">{c.from}</span>
                <ArrowRight className="h-3 w-3 shrink-0" />
                <span className="font-medium text-foreground">{c.to}</span>
                <span className="opacity-60">— {c.reason}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border/40 bg-muted/30 px-4 py-3">
            <button type="button" onClick={() => { setResult(null); setDraft("") }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> 다시 시도
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Story Mode ──────────────────────────────────────────────────────────────
function StoryMode({
  vocabulary,
  onSave,
}: {
  vocabulary: VocabularyItem[]
  onSave?: (title: string, content: Record<string, unknown>) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [length, setLength] = useState<StoryLength>("medium")
  const [result, setResult] = useState<StoryResult | null>(null)
  const [saved, setSaved] = useState(false)
  const { locale, strings } = useLocale()
  const [loading, setLoading] = useState(false)
  const { speak, speakingText } = useTts()

  const toggleWord = (word: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(vocabulary.map((v) => v.word)))
  const clearAll = () => setSelected(new Set())

  const generate = async () => {
    const words = vocabulary.filter((v) => selected.has(v.word))
    if (words.length === 0) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/study-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          words: words.map((v) => ({ word: v.word, type: v.type, korean: v.korean_translation })),
          length,
          targetLang: locale,
        }),
      })
      const data = await res.json() as StoryResult
      setResult(data)
      setSaved(false)
      onSave?.(
        data.titleKo ?? data.title,
        data as unknown as Record<string, unknown>
      )
      setSaved(true)
    } finally {
      setLoading(false)
    }
  }

  const usedWords = result?.usedWords ?? []

  return (
    <div className="flex flex-col gap-4">
      {/* Word selector */}
      {!result && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>{strings.study.selectWords} ({selected.size}/{vocabulary.length})</SectionLabel>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-[11px] text-primary hover:underline">{strings.study.selectAll}</button>
                <button type="button" onClick={clearAll} className="text-[11px] text-muted-foreground hover:text-foreground">{strings.study.clearSelection}</button>
              </div>
            </div>
            {vocabulary.length === 0 ? (
              <p className="text-sm text-muted-foreground">저장된 단어가 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {vocabulary.map((v) => (
                  <button
                    key={v.word}
                    type="button"
                    onClick={() => toggleWord(v.word)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all",
                      selected.has(v.word)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {v.word}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Length + generate */}
          <div className="flex items-center gap-3 border-t border-border/40 bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {strings.study.length}:
              {(["short", "medium", "long"] as StoryLength[]).map((l) => (
                <button key={l} type="button" onClick={() => setLength(l)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] transition-all",
                    length === l ? "border-primary bg-primary text-primary-foreground" : "border-border/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l === "short" ? strings.study.short : l === "long" ? strings.study.long : strings.study.medium}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={selected.size === 0 || loading}
              onClick={() => void generate()}
              className={cn(
                "ml-auto flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                selected.size > 0 && !loading
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? strings.study.generating : strings.study.generateStory}
            </button>
          </div>
        </div>
      )}

      {/* Story result */}
      {result && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {saved && (
            <div className="flex items-center gap-1.5 border-b border-border/40 bg-green-500/5 px-4 py-2 text-xs text-green-600 dark:text-green-400">
              <Check className="h-3 w-3" />
              자동 저장됨 — History에서 다시 볼 수 있어요
            </div>
          )}
          <div className="p-4 sm:p-5">
            {/* Title */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground">{result.titleKo}</p>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{result.title}</h2>
                <TtsBtn text={result.title} speak={speak} speakingText={speakingText} />
              </div>
            </div>

            {/* Paragraphs */}
            <div className="flex flex-col gap-4">
              {result.paragraphs.map((para, i) => (
                <div key={i}>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-[15px] leading-relaxed">
                      <HighlightedText text={para.en} words={usedWords} />
                    </p>
                    <TtsBtn text={para.en} speak={speak} speakingText={speakingText} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{para.ko}</p>
                </div>
              ))}
            </div>

            {/* Used words */}
            {usedWords.length > 0 && (
              <div className="mt-4">
                <SectionLabel>{strings.study.wordsUsed} {usedWords.length}</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {usedWords.map((w) => (
                    <span key={w} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-border/40 bg-muted/30 px-4 py-3">
            <button type="button" onClick={() => void generate()} disabled={loading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> 다시 만들기
            </button>
            <button type="button" onClick={() => { setResult(null) }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {strings.study.reselect}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Quiz Mode ────────────────────────────────────────────────────────────────
type QuizCard = VocabularyItem & { result?: "easy" | "hard" }
type QuizState = "idle" | "running" | "done"

function QuizMode({ vocabulary }: { vocabulary: VocabularyItem[] }) {
  const [state, setState] = useState<QuizState>("idle")
  const [cards, setCards] = useState<QuizCard[]>([])
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [easy, setEasy] = useState(0)
  const [hard, setHard] = useState(0)
  const [showHardOnly, setShowHardOnly] = useState(false)
  const { speak, speakingText } = useTts()

  const pool = vocabulary.filter((v) => !v.is_mastered)

  const startQuiz = (onlyHard = false) => {
    const source = onlyHard
      ? cards.filter((c) => c.result === "hard")
      : [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(pool.length, 20))
    setCards(source.map((v) => ({ ...v, result: undefined })))
    setIdx(0); setRevealed(false); setEasy(0); setHard(0)
    setState("running"); setShowHardOnly(onlyHard)
  }

  const grade = (result: "easy" | "hard") => {
    setCards((prev) => prev.map((c, i) => i === idx ? { ...c, result } : c))
    if (result === "easy") setEasy((n) => n + 1)
    else setHard((n) => n + 1)
    if (idx + 1 >= cards.length) { setState("done") }
    else { setIdx((n) => n + 1); setRevealed(false) }
  }

  const card = cards[idx]
  const progress = cards.length ? ((idx) / cards.length) * 100 : 0

  if (pool.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Brain className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">퀴즈할 단어가 없어요</p>
        <p className="text-xs text-muted-foreground/60">단어장에 단어를 추가하거나 학습 완료 필터를 해제해 보세요</p>
      </div>
    )
  }

  if (state === "idle") {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-lg">단어 퀴즈</p>
          <p className="text-sm text-muted-foreground mt-1">{Math.min(pool.length, 20)}개 단어를 플래시카드로 테스트해요</p>
        </div>
        <button
          type="button"
          onClick={() => startQuiz(false)}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
        >
          <Brain className="h-4 w-4" />
          퀴즈 시작
        </button>
      </div>
    )
  }

  if (state === "done") {
    const pct = Math.round((easy / (easy + hard)) * 100)
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
          <Trophy className="h-8 w-8 text-amber-500" />
        </div>
        <div>
          <p className="text-2xl font-bold">{pct}%</p>
          <p className="text-sm text-muted-foreground mt-0.5">정답률 ({easy}개 알아요 · {hard}개 어려워요)</p>
        </div>

        {/* Score bar */}
        <div className="w-full max-w-xs rounded-full bg-muted h-2 overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
        </div>

        {/* Missed words */}
        {hard > 0 && (
          <div className="w-full max-w-xs rounded-xl border border-border/60 bg-muted/30 p-3 text-left">
            <p className="text-xs font-semibold text-muted-foreground mb-2">어려웠던 단어 ({hard}개)</p>
            <div className="flex flex-wrap gap-1.5">
              {cards.filter((c) => c.result === "hard").map((c) => (
                <span key={c.id} className="rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-0.5 text-xs text-destructive">
                  {c.word}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {hard > 0 && (
            <button
              type="button"
              onClick={() => startQuiz(true)}
              className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              어려운 것만 다시
            </button>
          )}
          <button
            type="button"
            onClick={() => startQuiz(false)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            전체 다시
          </button>
        </div>
      </div>
    )
  }

  // Running state
  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-full bg-muted h-1.5 overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{idx + 1} / {cards.length}</span>
        <button type="button" onClick={() => setState("idle")} className="shrink-0 text-muted-foreground hover:text-foreground">
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Card */}
      {card && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {/* Type badge */}
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="rounded-full border border-border/50 px-2.5 py-0.5 text-[10px] text-muted-foreground">{card.type}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{easy} 😊 · {hard} 😅</span>
            </div>
          </div>

          {/* Word */}
          <div className="px-4 py-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <p className="text-3xl font-bold">{card.word}</p>
              <button
                type="button"
                onClick={() => speak(card.word)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border transition-all",
                  speakingText === card.word
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
            {card.example_sentence && !revealed && (
              <p className="text-sm text-muted-foreground/60 italic mt-1">
                "{card.example_sentence.slice(0, 60)}{card.example_sentence.length > 60 ? "…" : ""}"
              </p>
            )}
          </div>

          {/* Reveal / Answer */}
          {!revealed ? (
            <div className="border-t border-border/40 bg-muted/20 px-4 py-3 flex justify-center">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-5 py-2 text-sm font-medium hover:bg-muted transition"
              >
                <Eye className="h-4 w-4" />
                뜻 확인
              </button>
            </div>
          ) : (
            <div className="border-t border-border/40 bg-muted/20 px-4 py-4 space-y-3">
              {card.korean_translation && (
                <p className="text-center font-semibold text-base">{card.korean_translation}</p>
              )}
              {card.definition && (
                <p className="text-center text-sm text-muted-foreground">{card.definition}</p>
              )}
              {card.example_sentence && (
                <div className="flex items-start gap-1.5 rounded-lg bg-primary/5 px-3 py-2">
                  <p className="text-xs italic text-primary/80 flex-1">"{card.example_sentence}"</p>
                  <button
                    type="button"
                    onClick={() => speak(card.example_sentence!)}
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                      speakingText === card.example_sentence
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:text-primary"
                    )}
                  >
                    <Volume2 className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => grade("hard")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition"
                >
                  <ThumbsDown className="h-4 w-4" />
                  어려워요
                </button>
                <button
                  type="button"
                  onClick={() => grade("easy")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/5 py-3 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-500/10 transition"
                >
                  <ThumbsUp className="h-4 w-4" />
                  알아요!
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Challenge Mode ────────────────────────────────────────────────────────────
function ChallengeMode({ vocabulary }: { vocabulary: VocabularyItem[] }) {
  const [challengeWords, setChallengeWords] = useState<ChallengeWord[]>([])
  const [sentence, setSentence] = useState("")
  const [result, setResult] = useState<ChallengeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [showBetter, setShowBetter] = useState(false)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const { locale } = useLocale()
  const { speak, speakingText } = useTts()

  const pickWords = useCallback(() => {
    const pool = vocabulary.filter((v) => !v.is_mastered)
    if (pool.length === 0) return
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const count = Math.min(3, shuffled.length)
    setChallengeWords(shuffled.slice(0, count).map((v) => ({
      word: v.word,
      type: v.type,
      definition: v.definition,
      korean_translation: v.korean_translation,
    })))
    setSentence(""); setResult(null); setShowBetter(false)
  }, [vocabulary])

  useEffect(() => { if (vocabulary.length > 0) pickWords() }, [])

  const toggleMic = useCallback(() => {
    const SR =
      (typeof SpeechRecognition !== "undefined" ? SpeechRecognition : undefined) ??
      (typeof webkitSpeechRecognition !== "undefined" ? webkitSpeechRecognition : undefined)
    if (!SR) { alert("음성 인식을 지원하지 않는 브라우저예요."); return }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return }
    const rec = new SR()
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false
    let final = ""
    rec.onresult = (e) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim = e.results[i][0].transcript
      }
      setSentence(final + interim)
    }
    rec.onend = () => { setIsListening(false); if (final) setSentence(final) }
    rec.onerror = () => setIsListening(false)
    recognitionRef.current = rec
    rec.start(); setIsListening(true)
  }, [isListening])

  const submit = async () => {
    if (!sentence.trim() || loading) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch("/api/study-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence: sentence.trim(), words: challengeWords, targetLang: locale }),
      })
      setResult(await res.json() as ChallengeResult)
    } finally {
      setLoading(false)
    }
  }

  if (vocabulary.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Pencil className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">단어장에 단어를 추가하면 도전할 수 있어요</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Challenge words */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            이 단어들을 사용해서 문장을 만들어 보세요
          </p>
          <button
            type="button"
            onClick={pickWords}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw className="h-3 w-3" />
            새 단어
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {challengeWords.map((w) => (
            <div key={w.word} className="flex flex-col rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-primary">{w.word}</span>
                <button
                  type="button"
                  onClick={() => speak(w.word)}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border transition",
                    speakingText === w.word
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-primary"
                  )}
                >
                  <Volume2 className="h-3 w-3" />
                </button>
              </div>
              {w.korean_translation && (
                <span className="text-[11px] text-muted-foreground mt-0.5">{w.korean_translation}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="p-4">
          <div className={cn(
            "relative flex items-end gap-0 rounded-xl border bg-muted/30 transition-all",
            isListening ? "border-red-400/60 ring-2 ring-red-400/20" : "border-border/40 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
          )}>
            <textarea
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              placeholder={isListening ? "🎤 듣는 중…" : "영어 문장을 써보세요…"}
              rows={3}
              className="min-h-0 flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm leading-relaxed shadow-none focus:outline-none placeholder:text-muted-foreground/40"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit() } }}
            />
            <div className="flex shrink-0 items-center gap-1 pb-2 pr-2">
              <button type="button" onClick={toggleMic} className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition",
                isListening ? "animate-pulse bg-red-500/15 text-red-500" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="button"
                disabled={!sentence.trim() || loading}
                onClick={() => void submit()}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition",
                  sentence.trim() && !loading ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground"
                )}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground/50">⌘+Enter 제출</p>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {/* Score header */}
          <div className={cn(
            "flex items-center gap-4 px-4 py-4 border-b border-border/40",
            result.score >= 8 ? "bg-green-500/5" : result.score >= 5 ? "bg-amber-500/5" : "bg-muted/30"
          )}>
            <div className={cn(
              "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl font-bold",
              result.score >= 8 ? "bg-green-500/10 text-green-600 dark:text-green-400" :
              result.score >= 5 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
              "bg-muted text-muted-foreground"
            )}>
              <span className="text-2xl leading-none">{result.score}</span>
              <span className="text-[10px]">/ 10</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{result.praise}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {result.used_words.map((w) => (
                  <span key={w} className="rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                    ✓ {w}
                  </span>
                ))}
                {result.missed_words.map((w) => (
                  <span key={w} className="rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-[10px] font-medium text-destructive">
                    ✗ {w}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Tip */}
            {result.tip && (
              <div className="flex gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5">
                <Star className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <p className="text-sm">{result.tip}</p>
              </div>
            )}

            {/* Corrections */}
            {result.corrections.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">문법 교정</p>
                <div className="flex flex-col gap-1.5">
                  {result.corrections.map((c, i) => (
                    <div key={i} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs text-destructive line-through">{c.original}</span>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <span className="text-xs font-medium text-foreground">{c.suggestion}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{c.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Better version */}
            <div>
              <button
                type="button"
                onClick={() => setShowBetter((p) => !p)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition mb-1.5"
              >
                {showBetter ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                모범 답안 {showBetter ? "숨기기" : "보기"}
              </button>
              {showBetter && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-sm font-medium italic">{result.better_version}</p>
                    <button
                      type="button"
                      onClick={() => speak(result.better_version)}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition",
                        speakingText === result.better_version
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 text-muted-foreground hover:text-primary"
                      )}
                    >
                      <Volume2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Try again */}
          <div className="flex gap-2 border-t border-border/40 bg-muted/20 px-4 py-3">
            <button
              type="button"
              onClick={() => { setSentence(""); setResult(null); setShowBetter(false) }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              다시 써보기
            </button>
            <button
              type="button"
              onClick={pickWords}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              새 단어 도전
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

type PanelMode = "upgrade" | "story" | "quiz" | "challenge" | "history"

// ── History Item Card ────────────────────────────────────────────────────────
function HistoryItemCard({
  item,
  onArchive,
  onDelete,
}: {
  item: StudyResult
  onArchive: (id: string, archived: boolean) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const content = item.content
  const isUpgrade = item.type === "upgrade"

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      item.archived ? "border-border/30 bg-muted/20 opacity-60" : "border-border/60 bg-card"
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        <div className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px]",
          isUpgrade ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        )}>
          {isUpgrade ? <ArrowRight className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {isUpgrade ? "표현 업그레이드" : "이야기 만들기"} · {new Date(item.created_at).toLocaleDateString()}
          </p>
        </div>
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/40 px-3 pb-3 pt-2">
          {isUpgrade ? (
            <div className="space-y-2">
              {!!content.original && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">원문</p>
                  <p className="text-sm text-muted-foreground line-through">{String(content.original)}</p>
                </div>
              )}
              {!!content.improved && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">업그레이드</p>
                  <p className="text-sm font-medium">{String(content.improved)}</p>
                </div>
              )}
              {!!content.explanation && (
                <p className="text-xs text-muted-foreground">{String(content.explanation)}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {Array.isArray(content.paragraphs) && content.paragraphs.slice(0, 2).map((p, i) => (
                <div key={i}>
                  <p className="text-sm">{String((p as Record<string, unknown>).en ?? "")}</p>
                  <p className="text-xs text-muted-foreground">{String((p as Record<string, unknown>).ko ?? "")}</p>
                </div>
              ))}
              {Array.isArray(content.paragraphs) && content.paragraphs.length > 2 && (
                <p className="text-xs text-muted-foreground/60">+{content.paragraphs.length - 2}개 문단 더…</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-3 border-t border-border/30 pt-2">
            <button
              type="button"
              onClick={() => onArchive(item.id, !item.archived)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Archive className="h-3 w-3" />
              {item.archived ? "복원" : "보관"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="flex items-center gap-1 text-[11px] text-destructive/70 hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── History Mode ─────────────────────────────────────────────────────────────
function HistoryMode({ results, onArchive, onDelete }: {
  results: StudyResult[]
  onArchive: (id: string, archived: boolean) => void
  onDelete: (id: string) => void
}) {
  const [showArchived, setShowArchived] = useState(false)

  const active = results.filter((r) => !r.archived)
  const archived = results.filter((r) => r.archived)
  const displayed = showArchived ? results : active

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">아직 저장된 결과가 없어요</p>
        <p className="text-xs text-muted-foreground/60">표현 업그레이드나 이야기를 만들면 자동으로 저장돼요</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Archive toggle */}
      {archived.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{active.length}개 활성 · {archived.length}개 보관</p>
          <button
            type="button"
            onClick={() => setShowArchived((p) => !p)}
            className="text-xs text-primary hover:underline"
          >
            {showArchived ? "보관 숨기기" : `보관 ${archived.length}개 보기`}
          </button>
        </div>
      )}

      {displayed.map((item) => (
        <HistoryItemCard
          key={item.id}
          item={item}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

// ── Main StudyPanel ─────────────────────────────────────────────────────────
export function StudyPanel({ vocabulary, className, hidePaddingBottom }: {
  vocabulary: VocabularyItem[]
  className?: string
  hidePaddingBottom?: boolean
}) {
  const [mode, setMode] = useState<PanelMode>("upgrade")
  const [results, setResults] = useState<StudyResult[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const { strings } = useLocale()

  // Load history on first "history" tab visit
  const historyLoadedRef = useRef(false)
  const goHistory = () => {
    if (!historyLoadedRef.current) {
      historyLoadedRef.current = true
      setLoadingHistory(true)
      dbGetStudyResults()
        .then((data) => setResults(data))
        .finally(() => setLoadingHistory(false))
    }
    setMode("history")
  }

  const handleSaveResult = useCallback(async (
    type: "upgrade" | "story",
    title: string,
    content: Record<string, unknown>
  ) => {
    try {
      const saved = await dbCreateStudyResult(type, title, content)
      setResults((prev) => [saved, ...prev])
    } catch (e) {
      console.error("[StudyPanel] save failed:", e)
    }
  }, [])

  const handleArchive = useCallback(async (id: string, archived: boolean) => {
    setResults((prev) => prev.map((r) => r.id === id ? { ...r, archived } : r))
    await dbUpdateStudyResult(id, { archived }).catch(console.error)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id))
    await dbDeleteStudyResult(id).catch(console.error)
  }, [])

  // top two rows: primary modes (full-width cards), bottom row: icon-only shortcuts
  type ModeGroup = "practice" | "create"

  interface ModeEntry {
    key: PanelMode
    label: string
    icon: React.ElementType
    desc?: string
    group: ModeGroup | "util"
    color?: string
  }

  const PRIMARY_MODES: ModeEntry[] = [
    { key: "quiz",      label: "단어 퀴즈",   icon: Brain,     desc: "플래시카드로 자기 테스트", group: "practice", color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { key: "challenge", label: "문장 도전",   icon: Pencil,    desc: "단어로 문장 만들기 + AI 채점", group: "practice", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { key: "upgrade",   label: strings.study.upgradeTitle, icon: ArrowRight, desc: strings.study.upgradeDesc, group: "create", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { key: "story",     label: strings.study.storyTitle,   icon: BookOpen,   desc: strings.study.storyDesc,   group: "create", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  ]

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      {/* Mode selector grid */}
      <div className="shrink-0 px-3 pt-3 pb-2 sm:px-4">
        <div className="grid grid-cols-2 gap-2">
          {PRIMARY_MODES.map(({ key, label, icon: Icon, desc, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-all",
                mode === key
                  ? cn("border opacity-100", color)
                  : "border-border/60 bg-muted/30 text-muted-foreground opacity-70 hover:bg-muted/50 hover:text-foreground hover:opacity-100"
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{label}</span>
              </div>
              {desc && <span className="text-[10px] leading-tight opacity-70 font-normal">{desc}</span>}
            </button>
          ))}
        </div>

        {/* History pill */}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => goHistory()}
            className={cn(
              "relative flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-all",
              mode === "history"
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-border/50 bg-muted/20 text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-3 w-3" />
            History
            {results.filter((r) => !r.archived).length > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {results.filter((r) => !r.archived).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 sm:px-4",
        hidePaddingBottom ? "pb-2" : "pb-4"
      )}>
        {mode === "quiz" && <QuizMode vocabulary={vocabulary} />}
        {mode === "challenge" && <ChallengeMode vocabulary={vocabulary} />}
        {mode === "upgrade" && (
          <UpgradeMode
            vocabulary={vocabulary}
            onSave={(title, content) => void handleSaveResult("upgrade", title, content)}
          />
        )}
        {mode === "story" && (
          <StoryMode
            vocabulary={vocabulary}
            onSave={(title, content) => void handleSaveResult("story", title, content)}
          />
        )}
        {mode === "history" && (
          loadingHistory
            ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : <HistoryMode results={results} onArchive={handleArchive} onDelete={handleDelete} />
        )}
      </div>
    </div>
  )
}
