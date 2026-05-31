"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import {
  Mic, MicOff, Sparkles, ArrowRight, BookOpen, ChevronDown, ChevronUp,
  Loader2, RotateCcw, Volume2, VolumeX, Check, Clock, Archive, Trash2,
  ChevronRight, Brain, Pencil, Trophy, Star, RefreshCw, Eye, EyeOff,
  ThumbsUp, ThumbsDown, X as XIcon, Languages, BarChart3, Target, Lightbulb, Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { VocabularyItem, TutorSession } from "@/lib/types"
import type { StudyInsightsResult } from "@/app/api/study-insights/route"
import type { NextWordRec } from "@/app/api/study-insights-words/route"
import type { AddVocabPayload } from "@/components/add-vocab-dialog"
import type { UpgradeResult } from "@/app/api/study-upgrade/route"
import type { StoryResult } from "@/app/api/study-story/route"
import type { ChallengeResult, ChallengeWord } from "@/app/api/study-challenge/route"
import type { TranslateResult } from "@/app/api/study-translate/route"
import { useTts } from "@/hooks/use-tts"
import { useLocale } from "@/lib/locale-context"
import type { StudyResult } from "@/lib/types"
import { dbGetStudyResults, dbCreateStudyResult, dbUpdateStudyResult, dbDeleteStudyResult, dbGetLatestStudyInsight, dbSaveStudyInsight, type SavedInsightsContent } from "@/lib/db"
import { toast } from "sonner"

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

function QuizMode({ vocabulary, quizVocabulary, onMasterItem }: {
  vocabulary: VocabularyItem[]
  quizVocabulary?: VocabularyItem[]
  onMasterItem?: (id: string, currentValue: boolean) => void
}) {
  const [state, setState] = useState<QuizState>("idle")
  const [cards, setCards] = useState<QuizCard[]>([])
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [easy, setEasy] = useState(0)
  const [hard, setHard] = useState(0)
  const [showHardOnly, setShowHardOnly] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const { speak, speakingText } = useTts()

  const sourceVocab = quizVocabulary ?? vocabulary
  const collections = useMemo(
    () => [...new Set(sourceVocab.map((v) => v.collection).filter(Boolean))] as string[],
    [sourceVocab],
  )
  const pool = useMemo(() => {
    let list = sourceVocab.filter((v) => !v.is_mastered)
    if (selectedCollection) list = list.filter((v) => v.collection === selectedCollection)
    return list
  }, [sourceVocab, selectedCollection])

  const startQuiz = (onlyHard = false) => {
    const source = onlyHard
      ? cards.filter((c) => c.result === "hard")
      : [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(pool.length, 20))
    setCards(source.map((v) => ({ ...v, result: undefined })))
    setIdx(0); setRevealed(false); setEasy(0); setHard(0)
    setState("running"); setShowHardOnly(onlyHard)
  }

  const grade = (result: "easy" | "hard") => {
    const current = cards[idx]
    setCards((prev) => prev.map((c, i) => i === idx ? { ...c, result } : c))
    if (result === "easy") {
      setEasy((n) => n + 1)
      // Mark as mastered in the vocabulary list if not already mastered
      if (current && !current.is_mastered) {
        onMasterItem?.(current.id, false)
      }
    } else {
      setHard((n) => n + 1)
    }
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
    const quizCount = Math.min(pool.length, 20)
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center px-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-lg">단어 퀴즈</p>
          <p className="text-sm text-muted-foreground mt-1">{quizCount}개 단어를 플래시카드로 테스트해요</p>
        </div>

        {collections.length > 0 && (
          <div className="w-full max-w-sm space-y-2 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">단어장 선택</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCollection(null)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  selectedCollection === null
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground",
                )}
              >
                전체
              </button>
              {collections.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setSelectedCollection(col)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    selectedCollection === col
                      ? "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {col}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => startQuiz(false)}
          disabled={pool.length === 0}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-50"
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

// ── Translate Practice Mode ───────────────────────────────────────────────────
type TranslateStep = "input" | "result"

function TranslateMode({ vocabulary }: { vocabulary: VocabularyItem[] }) {
  const [korean, setKorean] = useState("")
  const [english, setEnglish] = useState("")
  const [step, setStep] = useState<TranslateStep>("input")
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showBetter, setShowBetter] = useState(false)
  const [isListeningKo, setIsListeningKo] = useState(false)
  const [isListeningEn, setIsListeningEn] = useState(false)
  const recKoRef = useRef<ISpeechRecognition | null>(null)
  const recEnRef = useRef<ISpeechRecognition | null>(null)
  const { locale } = useLocale()
  const { speak, speakingText } = useTts()

  const makeSR = (lang: string, onResult: (t: string) => void, onEnd: () => void) => {
    const SR =
      (typeof SpeechRecognition !== "undefined" ? SpeechRecognition : undefined) ??
      (typeof webkitSpeechRecognition !== "undefined" ? webkitSpeechRecognition : undefined)
    if (!SR) { alert("음성 인식을 지원하지 않는 브라우저예요."); return null }
    const rec = new SR()
    rec.lang = lang; rec.interimResults = true; rec.continuous = false
    let final = ""
    rec.onresult = (e) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim = e.results[i][0].transcript
      }
      onResult(final + interim)
    }
    rec.onend = () => { onEnd(); if (final) onResult(final) }
    rec.onerror = () => onEnd()
    return rec
  }

  const toggleMicKo = () => {
    if (isListeningKo) { recKoRef.current?.stop(); setIsListeningKo(false); return }
    const rec = makeSR("ko-KR", setKorean, () => setIsListeningKo(false))
    if (!rec) return
    recKoRef.current = rec; rec.start(); setIsListeningKo(true)
  }

  const toggleMicEn = () => {
    if (isListeningEn) { recEnRef.current?.stop(); setIsListeningEn(false); return }
    const rec = makeSR("en-US", setEnglish, () => setIsListeningEn(false))
    if (!rec) return
    recEnRef.current = rec; rec.start(); setIsListeningEn(true)
  }

  const submit = async () => {
    if (!korean.trim() || !english.trim() || loading) return
    setLoading(true); setResult(null); setShowBetter(false)
    try {
      const vocabPayload = vocabulary.slice(0, 40).map((v) => ({
        word: v.word, type: v.type, definition: v.definition,
      }))
      const res = await fetch("/api/study-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ korean: korean.trim(), english: english.trim(), vocabulary: vocabPayload, targetLang: locale }),
      })
      const data = await res.json() as TranslateResult
      setResult(data); setStep("result")
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setStep("input"); setResult(null); setShowBetter(false); setEnglish("") }
  const resetAll = () => { setStep("input"); setResult(null); setShowBetter(false); setKorean(""); setEnglish("") }

  const InputBox = ({
    value, onChange, placeholder, lang, isListening, onToggleMic, label, compact, className,
  }: {
    value: string; onChange: (v: string) => void; placeholder: string
    lang: "ko" | "en"; isListening: boolean; onToggleMic: () => void; label: string
    compact?: boolean
    className?: string
  }) => (
    <div className={cn("flex min-h-0 flex-col gap-1", !compact && className)}>
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <div className={cn(
        "relative flex min-h-0 rounded-xl border bg-muted/30 transition-all",
        !compact && "flex-1",
        isListening
          ? "border-red-400/60 ring-2 ring-red-400/20"
          : "border-border/40 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
      )}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isListening ? "🎤 듣는 중…" : placeholder}
          rows={compact ? 2 : 1}
          className={cn(
            "w-full min-h-0 flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm leading-relaxed shadow-none focus:outline-none placeholder:text-muted-foreground/40",
            compact && "min-h-[4.5rem]"
          )}
          onKeyDown={(e) => { if (lang === "en" && e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit() } }}
        />
        <button type="button" onClick={onToggleMic} className={cn(
          "absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full transition",
          isListening ? "animate-pulse bg-red-500/15 text-red-500" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}>
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm p-4 gap-3",
        result ? "shrink-0" : "min-h-0 flex-1"
      )}>
        <InputBox
          value={korean}
          onChange={setKorean}
          placeholder="영작하고 싶은 한국어 문장을 입력하세요…"
          lang="ko"
          isListening={isListeningKo}
          onToggleMic={toggleMicKo}
          label="한국어 원문"
          compact={!!result}
          className="flex-[2]"
        />
        <InputBox
          value={english}
          onChange={setEnglish}
          placeholder="위 문장을 영어로 써보세요…"
          lang="en"
          isListening={isListeningEn}
          onToggleMic={toggleMicEn}
          label="나의 영작"
          compact={!!result}
          className="flex-[3]"
        />
        <div className="flex shrink-0 items-center justify-between pt-1">
          <p className="hidden sm:block text-[11px] text-muted-foreground/50">⌘+Enter 제출</p>
          <div className="ml-auto flex gap-2">
            {(korean || english) && (
              <button type="button" onClick={resetAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
                <RotateCcw className="h-3.5 w-3.5" />
                초기화
              </button>
            )}
            <button
              type="button"
              disabled={!korean.trim() || !english.trim() || loading}
              onClick={() => void submit()}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition",
                korean.trim() && english.trim() && !loading
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />분석 중…</> : <><Sparkles className="h-4 w-4" />AI 분석</>}
            </button>
          </div>
        </div>
      </div>

      {/* Result — scroll only this section after analysis */}
      {result && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain pt-3">
          {/* Score header */}
          <div className={cn(
            "rounded-2xl border shadow-sm overflow-hidden",
            result.score >= 8 ? "border-green-500/30 bg-green-500/5" :
            result.score >= 5 ? "border-amber-500/30 bg-amber-500/5" :
            "border-border/60 bg-card"
          )}>
            <div className="flex items-center gap-4 px-4 py-4">
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
                <p className="text-sm font-medium leading-snug">{result.explanation}</p>
                {!result.meaning_ok && result.meaning_note && (
                  <p className="mt-1.5 text-xs text-destructive">⚠️ {result.meaning_note}</p>
                )}
              </div>
            </div>
          </div>

          {/* Corrections */}
          {result.corrections.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">교정 사항</p>
              <div className="flex flex-col gap-2">
                {result.corrections.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="text-xs text-destructive line-through">{c.original}</span>
                      <span className="text-[10px] text-muted-foreground">→</span>
                      <span className="text-xs font-medium">{c.suggestion}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{c.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Better version */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4">
            <button
              type="button"
              onClick={() => setShowBetter((p) => !p)}
              className="flex w-full items-center justify-between text-sm font-semibold"
            >
              <span>모범 영작</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showBetter && "rotate-180")} />
            </button>
            {showBetter && (
              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm leading-relaxed font-medium">{result.better_version}</p>
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

          {/* Alternatives */}
          {result.alternatives.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">다른 표현들</p>
              <div className="flex flex-col gap-2">
                {result.alternatives.map((alt, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{alt.text}</p>
                        <button
                          type="button"
                          onClick={() => speak(alt.text)}
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                            speakingText === alt.text
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/60 text-muted-foreground hover:text-primary"
                          )}
                        >
                          <Volume2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{alt.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vocab tips */}
          {result.vocab_tips.length > 0 && (
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 shadow-sm p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-violet-500/70">단어장 활용 팁</p>
              <p className="text-xs text-muted-foreground mb-2">이 문장에 어울리는 내 단어장 단어</p>
              <div className="flex flex-wrap gap-1.5">
                {result.vocab_tips.map((w) => (
                  <div key={w} className="flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1">
                    <span className="text-xs font-medium text-violet-700 dark:text-violet-300">{w}</span>
                    <button
                      type="button"
                      onClick={() => speak(w)}
                      className="text-violet-400 hover:text-violet-600"
                    >
                      <Volume2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button type="button" onClick={reset}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted transition">
              <RotateCcw className="h-3.5 w-3.5" />
              다시 영작
            </button>
            <button type="button" onClick={resetAll}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">
              <Languages className="h-3.5 w-3.5" />
              새 문장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

type PanelMode = "upgrade" | "story" | "quiz" | "challenge" | "translate" | "insights" | "history"

function extractTutorQueries(sessions: TutorSession[]) {
  const out: Array<{ type: "meaning" | "translate" | "naturalize"; query: string }> = []
  for (const session of sessions) {
    const assistantMsg = session.messages.find((m) => m.role === "assistant")
    let lookupType: "meaning" | "translate" | "naturalize" = "meaning"
    if (assistantMsg) {
      try {
        const parsed = JSON.parse(assistantMsg.content) as { type?: string }
        if (parsed.type === "meaning" || parsed.type === "translate" || parsed.type === "naturalize") {
          lookupType = parsed.type
        }
      } catch { /* plain text */ }
    } else {
      const title = session.title.toLowerCase()
      if (title.includes("번역") || title.includes("translate")) lookupType = "translate"
      else if (title.includes("자연") || title.includes("natural")) lookupType = "naturalize"
    }
    const query = session.messages.find((m) => m.role === "user")?.content.trim()
    if (query) out.push({ type: lookupType, query })
  }
  return out
}

function InsightsMode({
  vocabulary,
  tutorSessions,
  onAddWord,
}: {
  vocabulary: VocabularyItem[]
  tutorSessions: TutorSession[]
  onAddWord?: (item: AddVocabPayload) => Promise<void>
}) {
  const [result, setResult] = useState<StudyInsightsResult | null>(null)
  const [nextWords, setNextWords] = useState<NextWordRec[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [wordsLoading, setWordsLoading] = useState(false)
  const [addingWord, setAddingWord] = useState<{ key: string; mastered: boolean } | null>(null)
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const excludeWordsRef = useRef<string[]>([])
  const { locale } = useLocale()

  const tutorQueries = extractTutorQueries(tutorSessions)
  const mastered = vocabulary.filter((v) => v.is_mastered).length
  const canAnalyze = vocabulary.length >= 3 || tutorQueries.length >= 2

  const savedWordSet = useMemo(
    () => new Set(vocabulary.map((v) => v.word.toLowerCase())),
    [vocabulary],
  )

  useEffect(() => {
    let cancelled = false
    setLoadingSaved(true)
    dbGetLatestStudyInsight()
      .then((saved) => {
        if (cancelled || !saved) return
        const content = saved.content as unknown as SavedInsightsContent
        const parsed = content.result as unknown as StudyInsightsResult | undefined
        if (!parsed?.summary) return
        setResult(parsed)
        setNextWords(parsed.next_words ?? [])
        excludeWordsRef.current = content.excludeWords ?? [
          ...vocabulary.map((v) => v.word),
          ...(parsed.next_words ?? []).map((w) => w.word),
        ]
        setSavedAt(saved.created_at)
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false)
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load saved snapshot once on mount
  }, [])

  const run = async () => {
    if (!canAnalyze || loading) return
    setLoading(true); setError(null); setResult(null); setNextWords([]); setSavedAt(null)
    excludeWordsRef.current = vocabulary.map((v) => v.word)
    setAddedWords(new Set())
    try {
      const res = await fetch("/api/study-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vocabulary: vocabulary.slice(0, 100).map((v) => ({
            word: v.word, type: v.type, source: v.source, collection: v.collection,
            is_mastered: v.is_mastered, korean_translation: v.korean_translation, definition: v.definition,
          })),
          tutorQueries,
          targetLang: locale,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "분석 실패")
      const parsed = data as StudyInsightsResult
      setResult(parsed)
      setNextWords(parsed.next_words ?? [])
      excludeWordsRef.current = [
        ...excludeWordsRef.current,
        ...(parsed.next_words ?? []).map((w) => w.word),
      ]
      try {
        const saved = await dbSaveStudyInsight(parsed, excludeWordsRef.current)
        setSavedAt(saved.created_at)
      } catch {
        toast.error("분석 결과 저장에 실패했어요. 결과는 화면에만 표시됩니다.")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실패")
    } finally {
      setLoading(false)
    }
  }

  const refreshWords = async () => {
    if (wordsLoading) return
    setWordsLoading(true)
    try {
      const res = await fetch("/api/study-insights-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vocabulary: vocabulary.slice(0, 60).map((v) => ({
            word: v.word, type: v.type,
            korean_translation: v.korean_translation, definition: v.definition,
          })),
          topics: result?.word_topics,
          excludeWords: excludeWordsRef.current,
          targetLang: locale,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "단어 추천 실패")
      const words = (data.next_words ?? []) as NextWordRec[]
      setNextWords(words)
      excludeWordsRef.current = [...excludeWordsRef.current, ...words.map((w) => w.word)]
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "단어 추천 실패")
    } finally {
      setWordsLoading(false)
    }
  }

  const handleAddWord = async (w: NextWordRec, asMastered = false) => {
    const key = w.word.toLowerCase()
    if (!onAddWord || savedWordSet.has(key) || addedWords.has(key)) return
    setAddingWord({ key, mastered: asMastered })
    try {
      await onAddWord({
        word: w.word,
        type: "word",
        korean_translation: w.ko,
        definition: w.ko,
        example_sentence: w.example?.trim() || undefined,
        context: w.reason?.trim() || "AI 패턴 분석 추천",
        is_mastered: asMastered,
      })
      setAddedWords((prev) => new Set(prev).add(key))
    } catch {
      toast.error("단어 추가에 실패했어요")
    } finally {
      setAddingWord(null)
    }
  }

  if (!canAnalyze) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">분석할 데이터가 더 필요해요</p>
        <p className="text-xs text-muted-foreground/60">단어 3개 이상 저장하거나, Tutor에서 2번 이상 질문해 보세요</p>
      </div>
    )
  }

  if (loadingSaved) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">저장된 분석 불러오는 중…</p>
      </div>
    )
  }

  const savedLabel = savedAt
    ? new Date(savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain">
      {/* Stats + action */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium tabular-nums">단어 {vocabulary.length}</span>
          <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-600 dark:text-green-400 tabular-nums">완료 {mastered}</span>
          <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 tabular-nums">Tutor {tutorQueries.length}</span>
        </div>
        {savedLabel && result && (
          <p className="mb-2 text-[11px] text-muted-foreground">마지막 분석 · {savedLabel}</p>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => void run()}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : result ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "패턴 분석 중…" : result ? "다시 분석하기" : "AI 패턴 분석"}
        </button>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>

      {result && (
        <div className="flex flex-col gap-3 pb-2">
          {/* Summary */}
          <div className="rounded-2xl border border-teal-500/25 bg-teal-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600/70 dark:text-teal-400/70 mb-1.5">종합 분석</p>
            <p className="text-sm leading-relaxed">{result.summary}</p>
            {result.level_estimate && (
              <p className="mt-2 text-xs font-medium text-teal-700 dark:text-teal-300">📊 {result.level_estimate}</p>
            )}
          </div>

          {/* Topics */}
          {result.word_topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.word_topics.map((t) => (
                <span key={t} className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium">{t}</span>
              ))}
            </div>
          )}

          {/* Patterns */}
          {result.patterns.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                <BarChart3 className="h-3 w-3" /> 학습 패턴
              </p>
              <div className="flex flex-col gap-2">
                {result.patterns.map((p, i) => (
                  <div key={i} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak areas */}
          {result.weak_areas.length > 0 && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600/70">
                <Target className="h-3 w-3" /> 보완할 부분
              </p>
              <div className="flex flex-col gap-2">
                {result.weak_areas.map((w, i) => (
                  <div key={i} className="rounded-lg border border-amber-500/20 bg-background/60 px-3 py-2">
                    <p className="text-sm font-medium">{w.area}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{w.evidence}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">💡 {w.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                <Lightbulb className="h-3 w-3" /> 추천 학습
              </p>
              <div className="flex flex-col gap-2">
                {result.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                    <span className={cn(
                      "mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
                      r.priority === "high" ? "bg-red-500/10 text-red-600" :
                      r.priority === "medium" ? "bg-amber-500/10 text-amber-600" :
                      "bg-muted text-muted-foreground"
                    )}>{r.priority}</span>
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next words */}
          {nextWords.length > 0 && (
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500/70">다음에 배울 단어</p>
                <button
                  type="button"
                  onClick={() => void refreshWords()}
                  disabled={wordsLoading}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-violet-500/25 bg-background/80 px-2.5 py-1 text-[10px] font-medium text-violet-600 transition-colors hover:bg-violet-500/10 disabled:opacity-50 dark:text-violet-300"
                >
                  {wordsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  다른 단어 보기?
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {nextWords.map((w) => {
                  const key = w.word.toLowerCase()
                  const inVocab = savedWordSet.has(key)
                  const justAdded = addedWords.has(key)
                  const isAdding = addingWord?.key === key
                  const isAddingNormal = isAdding && !addingWord.mastered
                  const isAddingMastered = isAdding && addingWord.mastered
                  const canAdd = onAddWord && !inVocab && !justAdded

                  return (
                    <div key={key} className="flex items-start gap-2 rounded-lg border border-violet-500/15 bg-background/60 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-sm text-violet-700 dark:text-violet-300 shrink-0">{w.word}</span>
                          <span className="text-xs font-medium">{w.ko}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{w.reason}</p>
                      </div>
                      {onAddWord && (
                        <div className="flex shrink-0 flex-col gap-1">
                          {inVocab || justAdded ? (
                            <span className="flex items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              <Check className="h-3 w-3" />
                              추가됨
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleAddWord(w, false)}
                                disabled={!canAdd || isAdding}
                                className={cn(
                                  "flex items-center justify-center gap-1 rounded-lg border border-violet-500/25 bg-violet-500/10 px-2 py-1.5 text-[10px] font-medium text-violet-600 transition-colors hover:bg-violet-500/20 dark:text-violet-300",
                                  (!canAdd || isAdding) && "opacity-70",
                                )}
                              >
                                {isAddingNormal ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                단어장에 추가
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleAddWord(w, true)}
                                disabled={!canAdd || isAdding}
                                className={cn(
                                  "flex items-center justify-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5 text-[10px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400",
                                  (!canAdd || isAdding) && "opacity-70",
                                )}
                              >
                                {isAddingMastered ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                이미 외운 단어 추가
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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

  const historyResults = results.filter((r) => r.type !== "insights")
  const active = historyResults.filter((r) => !r.archived)
  const archived = historyResults.filter((r) => r.archived)
  const displayed = showArchived ? historyResults : active

  if (historyResults.length === 0) {
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
export function StudyPanel({ vocabulary, tutorSessions = [], insightsVocabulary, quizVocabulary, onMasterItem, onAddRecommendedWord, className, hidePaddingBottom }: {
  vocabulary: VocabularyItem[]
  tutorSessions?: TutorSession[]
  /** Full vocab list for pattern analysis (defaults to vocabulary) */
  insightsVocabulary?: VocabularyItem[]
  /** Full vocab list for quiz collection picker (defaults to vocabulary) */
  quizVocabulary?: VocabularyItem[]
  onMasterItem?: (id: string, currentValue: boolean) => void
  onAddRecommendedWord?: (item: AddVocabPayload) => Promise<void>
  className?: string
  hidePaddingBottom?: boolean
}) {
  const [mode, setMode] = useState<PanelMode>("upgrade")
  const [results, setResults] = useState<StudyResult[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const { strings } = useLocale()
  const vocabForInsights = insightsVocabulary ?? vocabulary

  // Load history on first "history" tab visit
  const historyLoadedRef = useRef(false)
  const goHistory = () => {
    if (!historyLoadedRef.current) {
      historyLoadedRef.current = true
      setLoadingHistory(true)
      dbGetStudyResults()
        .then(({ items, tableMissing }) => {
          setResults(items)
          if (tableMissing) {
            toast.error("History 테이블이 없어요. Supabase SQL Editor에서 supabase/migrations/add_study_results.sql 을 실행해 주세요.")
          }
        })
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
    { key: "quiz",      label: "단어 퀴즈",   icon: Brain,     desc: "플래시카드로 자기 테스트",       group: "practice", color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { key: "insights",  label: "패턴 분석",   icon: BarChart3,  desc: "단어·질문 AI 학습 인사이트", group: "create", color: "text-teal-500 bg-teal-500/10 border-teal-500/20" },
    { key: "challenge", label: "문장 도전",   icon: Pencil,    desc: "단어로 문장 만들기 + AI 채점",   group: "practice", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { key: "translate", label: "영작 연습",   icon: Languages, desc: "한국어 → 영어 영작 후 AI 첨삭", group: "practice", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
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
            {results.filter((r) => !r.archived && r.type !== "insights").length > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {results.filter((r) => !r.archived && r.type !== "insights").length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        "flex min-h-0 flex-1 flex-col px-3 sm:px-4",
        mode === "translate" ? "overflow-hidden" : "overflow-y-auto overscroll-y-contain",
        hidePaddingBottom ? "pb-2" : "pb-4"
      )}>
        {mode === "quiz" && (
          <QuizMode
            vocabulary={vocabulary}
            quizVocabulary={quizVocabulary ?? insightsVocabulary ?? vocabulary}
            onMasterItem={onMasterItem}
          />
        )}
        {mode === "challenge" && <ChallengeMode vocabulary={vocabulary} />}
        {mode === "translate" && <TranslateMode vocabulary={vocabulary} />}
        {mode === "insights" && (
          <InsightsMode
            vocabulary={vocabForInsights}
            tutorSessions={tutorSessions}
            onAddWord={onAddRecommendedWord}
          />
        )}
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
