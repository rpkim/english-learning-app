"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import {
  Mic, MicOff, Sparkles, ArrowRight, BookOpen, ChevronDown, ChevronUp,
  Loader2, RotateCcw, Volume2, VolumeX, Check, Trash2,
  ChevronRight, ChevronLeft, Brain, Pencil, Trophy, Star, RefreshCw, Eye, EyeOff,
  ThumbsUp, ThumbsDown, X as XIcon, Languages, BarChart3, Target, Lightbulb, Plus, PenLine,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { VocabularyItem, TutorSession, UserSentence } from "@/lib/types"
import type { StudyInsightsResult } from "@/app/api/study-insights/route"
import type { NextWordRec } from "@/app/api/study-insights-words/route"
import type { AddVocabPayload } from "@/components/add-vocab-dialog"
import { getKoreanTranslationText } from "@/components/vocabulary-card"
import type { UpgradeResult } from "@/app/api/study-upgrade/route"
import type { StoryResult } from "@/app/api/study-story/route"
import type { ChallengeResult, ChallengeWord } from "@/app/api/study-challenge/route"
import type { TranslateResult } from "@/app/api/study-translate/route"
import { useTts } from "@/hooks/use-tts"
import { useLocale } from "@/lib/locale-context"
import { dbCreateStudyResult, dbGetLatestStudyInsight, dbSaveStudyInsight, type SavedInsightsContent } from "@/lib/db"
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
              결과가 저장됐어요
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
              결과가 저장됐어요
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

// ── Word Study (암기 + 퀴즈) ─────────────────────────────────────────────────
type QuizCard = VocabularyItem & { result?: "easy" | "hard" }
type WordStudySubMode = "memorize" | "quiz"
type WordStudyState = "idle" | "running" | "done"

function CollectionPicker({
  collections,
  selectedCollection,
  onSelect,
}: {
  collections: string[]
  selectedCollection: string | null
  onSelect: (col: string | null) => void
}) {
  if (collections.length === 0) return null
  return (
    <div className="w-full max-w-sm space-y-2 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">단어장 선택</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
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
            onClick={() => onSelect(col)}
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
  )
}

function QuizMode({ vocabulary, quizVocabulary, onMasterItem }: {
  vocabulary: VocabularyItem[]
  quizVocabulary?: VocabularyItem[]
  onMasterItem?: (id: string, currentValue: boolean) => void
}) {
  const [state, setState] = useState<WordStudyState>("idle")
  const [subMode, setSubMode] = useState<WordStudySubMode | null>(null)
  const [cards, setCards] = useState<QuizCard[]>([])
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [easy, setEasy] = useState(0)
  const [hard, setHard] = useState(0)
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [quizViewedOnly, setQuizViewedOnly] = useState(false)
  const { speak, speakingText } = useTts()

  const sourceVocab = quizVocabulary ?? vocabulary
  const collections = useMemo(
    () => [...new Set(sourceVocab.map((v) => v.collection).filter(Boolean))] as string[],
    [sourceVocab],
  )

  const filterByCollection = useCallback(
    (list: VocabularyItem[]) =>
      selectedCollection ? list.filter((v) => v.collection === selectedCollection) : list,
    [selectedCollection],
  )

  const memorizePool = useMemo(
    () => filterByCollection(sourceVocab),
    [sourceVocab, filterByCollection],
  )

  const quizPool = useMemo(() => {
    let pool = filterByCollection(sourceVocab.filter((v) => !v.is_mastered))
    if (quizViewedOnly) {
      pool = pool.filter((v) => (v.view_count ?? 0) > 0)
    }
    return pool
  }, [sourceVocab, filterByCollection, quizViewedOnly])

  const viewedQuizCount = useMemo(
    () =>
      filterByCollection(sourceVocab.filter((v) => !v.is_mastered && (v.view_count ?? 0) > 0)).length,
    [sourceVocab, filterByCollection],
  )

  const exitSession = () => {
    setState("idle")
    setSubMode(null)
    setCards([])
    setIdx(0)
    setRevealed(false)
    setEasy(0)
    setHard(0)
  }

  const shuffle = <T,>(list: T[]) => [...list].sort(() => Math.random() - 0.5)

  const startMemorize = () => {
    if (memorizePool.length === 0) return
    setCards(shuffle(memorizePool))
    setIdx(0)
    setSubMode("memorize")
    setState("running")
  }

  const startQuiz = (onlyHard = false) => {
    const source = onlyHard
      ? shuffle(cards.filter((c) => c.result === "hard"))
      : shuffle(quizPool).slice(0, Math.min(quizPool.length, 20))
    if (source.length === 0) return
    setCards(source.map((v) => ({ ...v, result: undefined })))
    setIdx(0)
    setRevealed(false)
    setEasy(0)
    setHard(0)
    setSubMode("quiz")
    setState(onlyHard ? "running" : "running")
  }

  const grade = (result: "easy" | "hard") => {
    const current = cards[idx]
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, result } : c)))
    if (result === "easy") {
      setEasy((n) => n + 1)
      if (current && !current.is_mastered) {
        onMasterItem?.(current.id, false)
      }
    } else {
      setHard((n) => n + 1)
    }
    goNextCard()
  }

  const goNextCard = () => {
    if (idx + 1 >= cards.length) setState("done")
    else {
      setIdx((n) => n + 1)
      setRevealed(false)
    }
  }

  const goCard = (delta: number) => {
    setIdx((i) => Math.max(0, Math.min(cards.length - 1, i + delta)))
  }

  useEffect(() => {
    if (state !== "running" || subMode !== "memorize") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goCard(-1)
      if (e.key === "ArrowRight") goCard(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state, subMode, cards.length])

  const card = cards[idx]
  const progress = cards.length ? (idx / cards.length) * 100 : 0

  if (memorizePool.length === 0 && quizPool.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Brain className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          {quizViewedOnly ? "봤어요한 단어가 없어요" : "학습할 단어가 없어요"}
        </p>
        <p className="text-xs text-muted-foreground/60">
          {quizViewedOnly
            ? "단어장 카드에서 「봤어요」를 눌러 본 단어를 표시해 보세요"
            : "단어장에 단어를 추가해 보세요"}
        </p>
      </div>
    )
  }

  if (state === "idle") {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center px-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-lg">단어 학습</p>
          <p className="text-sm text-muted-foreground mt-1">암기로 익히거나, 퀴즈로 테스트해요</p>
        </div>

        <CollectionPicker
          collections={collections}
          selectedCollection={selectedCollection}
          onSelect={setSelectedCollection}
        />

        <button
          type="button"
          onClick={() => setQuizViewedOnly((p) => !p)}
          disabled={viewedQuizCount === 0}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            quizViewedOnly
              ? "border-sky-400/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
              : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground",
          )}
        >
          <Eye className="h-3 w-3" />
          봤어요한 단어만
          {viewedQuizCount > 0 && (
            <span className="tabular-nums opacity-80">{viewedQuizCount}</span>
          )}
        </button>

        <div className="flex w-full max-w-sm flex-col gap-2">
          <button
            type="button"
            onClick={startMemorize}
            disabled={memorizePool.length === 0}
            className="flex flex-col items-center gap-1 rounded-2xl border border-violet-500/25 bg-violet-500/5 px-4 py-4 text-left transition hover:bg-violet-500/10 disabled:opacity-50"
          >
            <div className="flex items-center gap-2 font-semibold text-violet-700 dark:text-violet-300">
              <BookOpen className="h-4 w-4" />
              단어 암기
            </div>
            <p className="text-xs text-muted-foreground">
              뜻·예문을 보며 {memorizePool.length}개 카드 넘기기
            </p>
          </button>
          <button
            type="button"
            onClick={() => startQuiz(false)}
            disabled={quizPool.length === 0}
            className="flex flex-col items-center gap-1 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-4 text-left transition hover:bg-primary/10 disabled:opacity-50"
          >
            <div className="flex items-center gap-2 font-semibold text-primary">
              <Brain className="h-4 w-4" />
              단어 퀴즈
            </div>
            <p className="text-xs text-muted-foreground">
              {quizViewedOnly
                ? `봤어요 ${Math.min(quizPool.length, 20)}개 · 뜻 숨김 플래시카드`
                : `뜻 숨김 · ${Math.min(quizPool.length, 20)}개 플래시카드 테스트`}
            </p>
          </button>
        </div>
      </div>
    )
  }

  if (state === "done" && subMode === "quiz") {
    const pct = easy + hard > 0 ? Math.round((easy / (easy + hard)) * 100) : 0
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
          <Trophy className="h-8 w-8 text-amber-500" />
        </div>
        <div>
          <p className="text-2xl font-bold">{pct}%</p>
          <p className="text-sm text-muted-foreground mt-0.5">정답률 ({easy}개 알아요 · {hard}개 어려워요)</p>
        </div>
        <div className="w-full max-w-xs rounded-full bg-muted h-2 overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
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
          <button
            type="button"
            onClick={exitSession}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition"
          >
            목록
          </button>
        </div>
      </div>
    )
  }

  // ── Running: 단어 암기 ──
  if (subMode === "memorize" && card) {
    const korean = getKoreanTranslationText(card.korean_translation)
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex-1 rounded-full bg-muted h-1.5 overflow-hidden">
            <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{idx + 1} / {cards.length}</span>
          <button type="button" onClick={exitSession} className="shrink-0 text-muted-foreground hover:text-foreground">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="rounded-2xl border border-violet-500/20 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4">
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                단어 암기
              </span>
              {card.collection && (
                <span className="text-[10px] text-muted-foreground">{card.collection}</span>
              )}
            </div>

            <div className="px-4 py-5 text-center border-b border-border/40">
              <div className="flex items-center justify-center gap-2 mb-3">
                <p className="text-3xl font-bold">{card.word}</p>
                <button
                  type="button"
                  onClick={() => speak(card.word)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border transition-all",
                    speakingText === card.word
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
              {korean && (
                <p className="text-lg font-semibold text-foreground">{korean}</p>
              )}
              {card.definition && card.definition !== korean && (
                <p className="text-sm text-muted-foreground mt-1.5">{card.definition}</p>
              )}
            </div>

            {card.example_sentence && (
              <div className="px-4 py-3 border-b border-border/40 bg-primary/5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">예문</p>
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm italic leading-relaxed">&ldquo;{card.example_sentence}&rdquo;</p>
                  <button
                    type="button"
                    onClick={() => speak(card.example_sentence!)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {card.context && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">맥락</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{card.context}</p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-between gap-3 pb-1">
          <button
            type="button"
            onClick={() => goCard(-1)}
            disabled={idx === 0}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-[11px] text-muted-foreground">좌우로 넘겨요</p>
          <button
            type="button"
            onClick={() => goCard(1)}
            disabled={idx >= cards.length - 1}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    )
  }

  // ── Running: 단어 퀴즈 ──
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-full bg-muted h-1.5 overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{idx + 1} / {cards.length}</span>
        <button type="button" onClick={exitSession} className="shrink-0 text-muted-foreground hover:text-foreground">
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {card && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
              단어 퀴즈
            </span>
            <span className="text-xs text-muted-foreground">{easy} 😊 · {hard} 😅</span>
          </div>

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
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
            {card.example_sentence && !revealed && (
              <p className="text-sm text-muted-foreground/60 italic mt-1">
                &ldquo;{card.example_sentence.slice(0, 60)}{card.example_sentence.length > 60 ? "…" : ""}&rdquo;
              </p>
            )}
          </div>

          {!revealed ? (
            <div className="border-t border-border/40 bg-muted/20 px-4 py-3 flex gap-2">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition"
              >
                <Eye className="h-4 w-4" />
                뜻 확인
              </button>
              <button
                type="button"
                onClick={goNextCard}
                className="flex shrink-0 items-center justify-center gap-1 rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <ChevronRight className="h-4 w-4" />
                다음
              </button>
            </div>
          ) : (
            <div className="border-t border-border/40 bg-muted/20 px-4 py-4 space-y-3">
              {getKoreanTranslationText(card.korean_translation) && (
                <p className="text-center font-semibold text-base">
                  {getKoreanTranslationText(card.korean_translation)}
                </p>
              )}
              {card.definition && (
                <p className="text-center text-sm text-muted-foreground">{card.definition}</p>
              )}
              {card.example_sentence && (
                <div className="flex items-start gap-1.5 rounded-lg bg-primary/5 px-3 py-2">
                  <p className="text-xs italic text-primary/80 flex-1">&ldquo;{card.example_sentence}&rdquo;</p>
                  <button
                    type="button"
                    onClick={() => speak(card.example_sentence!)}
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                      speakingText === card.example_sentence
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:text-primary",
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
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition"
                >
                  <ThumbsDown className="h-4 w-4 shrink-0" />
                  <span className="truncate">어려워요</span>
                </button>
                <button
                  type="button"
                  onClick={goNextCard}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  <span className="truncate">다음</span>
                </button>
                <button
                  type="button"
                  onClick={() => grade("easy")}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/5 py-3 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-500/10 transition"
                >
                  <ThumbsUp className="h-4 w-4 shrink-0" />
                  <span className="truncate">알아요!</span>
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

type PanelMode = "upgrade" | "story" | "quiz" | "challenge" | "translate" | "insights" | "my-sentences"

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

// ── My Sentences Mode ────────────────────────────────────────────────────────
interface AggregatedSentence {
  vocabId: string
  word: string
  sentence: UserSentence
}

function MySentencesMode({
  vocabulary,
  onUpdateVocab,
}: {
  vocabulary: VocabularyItem[]
  onUpdateVocab?: (id: string, fields: Partial<Pick<VocabularyItem, "user_sentences">>) => void | Promise<void>
}) {
  const { speak, speakingText } = useTts()

  const entries = useMemo(() => {
    const list: AggregatedSentence[] = []
    for (const v of vocabulary) {
      for (const s of v.user_sentences ?? []) {
        list.push({ vocabId: v.id, word: v.word, sentence: s })
      }
    }
    return list.sort(
      (a, b) => new Date(b.sentence.created_at).getTime() - new Date(a.sentence.created_at).getTime(),
    )
  }, [vocabulary])

  const handleDelete = useCallback(async (entry: AggregatedSentence) => {
    if (!onUpdateVocab) return
    const vocab = vocabulary.find((v) => v.id === entry.vocabId)
    if (!vocab) return
    const next = (vocab.user_sentences ?? []).filter((s) => s.id !== entry.sentence.id)
    try {
      await onUpdateVocab(entry.vocabId, { user_sentences: next })
      toast.success("문장을 삭제했어요")
    } catch {
      /* toast handled upstream */
    }
  }, [onUpdateVocab, vocabulary])

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <PenLine className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">저장된 내 문장이 없어요</p>
        <p className="max-w-[240px] text-xs text-muted-foreground/60">
          단어장 카드에서 「내 문장」으로 나중에 쓸 표현을 저장해 두면 여기서 모아볼 수 있어요
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{entries.length}개 문장</p>
      {entries.map(({ vocabId, word, sentence }) => (
        <div
          key={sentence.id}
          className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5"
        >
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
              {word}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <TtsBtn text={sentence.text} speak={speak} speakingText={speakingText} />
              {onUpdateVocab && (
                <button
                  type="button"
                  onClick={() => void handleDelete({ vocabId, word, sentence })}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  title="삭제"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm leading-relaxed">{sentence.text}</p>
          <p className="mt-1.5 text-[10px] text-muted-foreground/60">
            {new Date(sentence.created_at).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Main StudyPanel ─────────────────────────────────────────────────────────
export function StudyPanel({ vocabulary, tutorSessions = [], insightsVocabulary, quizVocabulary, sentencesVocabulary, onMasterItem, onAddRecommendedWord, onUpdateVocab, className, hidePaddingBottom }: {
  vocabulary: VocabularyItem[]
  tutorSessions?: TutorSession[]
  /** Full vocab list for pattern analysis (defaults to vocabulary) */
  insightsVocabulary?: VocabularyItem[]
  /** Full vocab list for quiz collection picker (defaults to vocabulary) */
  quizVocabulary?: VocabularyItem[]
  /** Full vocab list for my-sentences aggregation (defaults to vocabulary) */
  sentencesVocabulary?: VocabularyItem[]
  onMasterItem?: (id: string, currentValue: boolean) => void
  onAddRecommendedWord?: (item: AddVocabPayload) => Promise<void>
  onUpdateVocab?: (id: string, fields: Partial<Pick<VocabularyItem, "user_sentences">>) => void | Promise<void>
  className?: string
  hidePaddingBottom?: boolean
}) {
  const [mode, setMode] = useState<PanelMode>("upgrade")
  const { strings } = useLocale()
  const vocabForInsights = insightsVocabulary ?? vocabulary
  const vocabForSentences = sentencesVocabulary ?? vocabulary
  const sentenceCount = useMemo(
    () => vocabForSentences.reduce((n, v) => n + (v.user_sentences?.length ?? 0), 0),
    [vocabForSentences],
  )

  const handleSaveResult = useCallback(async (
    type: "upgrade" | "story",
    title: string,
    content: Record<string, unknown>
  ) => {
    try {
      await dbCreateStudyResult(type, title, content)
    } catch (e) {
      console.error("[StudyPanel] save failed:", e)
    }
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
    { key: "quiz",      label: "단어 학습",   icon: Brain,     desc: "단어 암기 · 플래시카드 퀴즈",   group: "practice", color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
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

        {/* My sentences pill */}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setMode("my-sentences")}
            className={cn(
              "relative flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-all",
              mode === "my-sentences"
                ? "border-amber-500/40 bg-amber-500/10 text-foreground"
                : "border-border/50 bg-muted/20 text-muted-foreground hover:text-foreground",
            )}
          >
            <PenLine className="h-3 w-3" />
            내 문장
            {sentenceCount > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                {sentenceCount}
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
        {mode === "my-sentences" && (
          <MySentencesMode vocabulary={vocabForSentences} onUpdateVocab={onUpdateVocab} />
        )}
      </div>
    </div>
  )
}
