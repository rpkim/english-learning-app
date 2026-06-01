"use client"

import { useState, useEffect } from "react"
import { VocabularyItem, type UserSentence } from "@/lib/types"
import { CheckCircle2, Circle, Volume2, VolumeX, Sparkles, GitBranch, Loader2, Globe, ImageDown, Eye, EyeOff, PenLine } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTts } from "@/hooks/use-tts"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { downloadVocabImage } from "@/lib/vocab-image"
import { toast } from "sonner"
import type { ChallengeResult } from "@/app/api/study-challenge/route"

// ── Constants ──────────────────────────────────────────────────────────────
export const TYPE_COLORS: Record<string, string> = {
  word:        "bg-primary/10 text-primary border-primary/20",
  idiom:       "bg-primary/10 text-primary border-primary/20",
  slang:       "bg-primary/10 text-primary border-primary/20",
  phrasal_verb:"bg-primary/10 text-primary border-primary/20",
  expression:  "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-600/40",
  rephrase:    "bg-teal-500/10 text-teal-700 border-teal-300 dark:text-teal-400 dark:border-teal-600/40",
}

export const TYPE_LABELS: Record<string, string> = {
  word: "Word",
  idiom: "Word",
  slang: "Word",
  phrasal_verb: "Word",
  expression: "Expression",
  rephrase: "Rephrase",
}

const SOURCE_COLORS: Record<string, string> = {
  session: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  tutor:   "bg-green-500/10 text-green-600 dark:text-green-400",
  manual:  "bg-muted text-muted-foreground",
}

const SOURCE_LABELS: Record<string, string> = {
  session: "Session",
  tutor: "Tutor",
  manual: "Manual",
}

// ── Helper ─────────────────────────────────────────────────────────────────
export function getKoreanTranslationText(raw: unknown): string {
  if (typeof raw === "string") return raw
  if (!raw || typeof raw !== "object") return ""
  const obj = raw as Record<string, unknown>
  return (
    (typeof obj.korean_translation === "string" ? obj.korean_translation : "") ||
    (typeof obj.meaning === "string" ? obj.meaning : "") ||
    (typeof obj.usage === "string" ? obj.usage : "")
  )
}

// ── Section label ──────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
      {children}
    </p>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────
export interface VocabularyCardProps {
  item: VocabularyItem
  onToggleMastered: (id: string, current: boolean) => void
  onTranslate: (item: VocabularyItem) => void
  onUpdateItem?: (id: string, fields: Partial<Pick<VocabularyItem, "extra_examples" | "etymology" | "related_forms" | "view_count" | "user_sentences">>) => void | Promise<void>
  isTranslating: boolean
  /** Compact = list view. Full = deck view (no border, renders inline). */
  variant?: "list" | "full"
}

export function VocabularyCard({
  item,
  onToggleMastered,
  onTranslate,
  onUpdateItem,
  isTranslating,
  variant = "list",
}: VocabularyCardProps) {
  const { speak, speakingText } = useTts()
  const [extraExamples, setExtraExamples] = useState<string[] | null>(
    item.extra_examples?.length ? item.extra_examples : null,
  )
  const [etymology, setEtymology] = useState<string | null>(item.etymology ?? null)
  const [relatedForms, setRelatedForms] = useState<string | null>(item.related_forms ?? null)
  const [loadingExamples, setLoadingExamples] = useState(false)
  const [loadingEtymology, setLoadingEtymology] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [viewCount, setViewCount] = useState(item.view_count ?? 0)
  const [incrementingView, setIncrementingView] = useState(false)
  const [userSentences, setUserSentences] = useState<UserSentence[]>(item.user_sentences ?? [])
  const [showAddSentence, setShowAddSentence] = useState(false)
  const [sentenceDraft, setSentenceDraft] = useState("")
  const [savingSentence, setSavingSentence] = useState(false)
  const [reviewingSentence, setReviewingSentence] = useState(false)
  const [sentenceReview, setSentenceReview] = useState<ChallengeResult | null>(null)
  const [showBetterReview, setShowBetterReview] = useState(false)

  useEffect(() => {
    setExtraExamples(item.extra_examples?.length ? item.extra_examples : null)
    setEtymology(item.etymology ?? null)
    setRelatedForms(item.related_forms ?? null)
    setViewCount(item.view_count ?? 0)
    setUserSentences(item.user_sentences ?? [])
    setShowAddSentence(false)
    setSentenceDraft("")
    setSentenceReview(null)
    setShowBetterReview(false)
    setReviewingSentence(false)
    setAiError(null)
    setLoadingExamples(false)
    setLoadingEtymology(false)
    setIncrementingView(false)
    setSavingSentence(false)
  }, [item.id, item.extra_examples, item.etymology, item.related_forms, item.view_count, item.user_sentences])

  const koreanText = getKoreanTranslationText(item.korean_translation)

  const runDeepDive = async (mode: "examples" | "etymology") => {
    setAiError(null)
    if (mode === "examples") setLoadingExamples(true)
    else setLoadingEtymology(true)
    try {
      const res = await fetch("/api/vocabulary-deep-dive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: item.word, type: item.type,
          definition: item.definition ?? "",
          example_sentence: item.example_sentence ?? "",
          context: item.context ?? "", mode,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setAiError(data?.error ?? "오류"); return }
      if (mode === "examples") {
        const ex = Array.isArray(data?.extra_examples)
          ? data.extra_examples.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
          : []
        setExtraExamples(ex)
        if (ex.length > 0) {
          await onUpdateItem?.(item.id, { extra_examples: ex })
        }
      } else {
        const etym = typeof data?.etymology === "string" ? data.etymology.trim() : ""
        const related = typeof data?.related_forms === "string" ? data.related_forms.trim() : ""
        setEtymology(etym || null)
        setRelatedForms(related || null)
        if (etym || related) {
          await onUpdateItem?.(item.id, {
            etymology: etym || null,
            related_forms: related || null,
          })
        }
      }
    } catch { setAiError("Network error") }
    finally {
      if (mode === "examples") setLoadingExamples(false)
      else setLoadingEtymology(false)
    }
  }

  const handleIncrementView = async () => {
    if (!onUpdateItem || incrementingView) return
    const prev = viewCount
    const next = prev + 1
    setViewCount(next)
    setIncrementingView(true)
    try {
      await onUpdateItem(item.id, { view_count: next })
    } catch {
      setViewCount(prev)
    } finally {
      setIncrementingView(false)
    }
  }

  const handleReviewSentence = async () => {
    const text = sentenceDraft.trim()
    if (!text || reviewingSentence) return
    setReviewingSentence(true)
    setSentenceReview(null)
    setShowBetterReview(false)
    try {
      const res = await fetch("/api/study-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentence: text,
          words: [{
            word: item.word,
            type: item.type,
            definition: item.definition,
            korean_translation: koreanText || null,
          }],
          targetLang: "ko",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "AI 검토에 실패했어요")
        return
      }
      setSentenceReview(data as ChallengeResult)
    } catch {
      toast.error("네트워크 오류")
    } finally {
      setReviewingSentence(false)
    }
  }

  const handleSaveSentence = async () => {
    const text = sentenceDraft.trim()
    if (!text || !onUpdateItem || savingSentence) return
    const entry: UserSentence = {
      id: crypto.randomUUID(),
      text,
      created_at: new Date().toISOString(),
    }
    const next = [entry, ...userSentences]
    setSavingSentence(true)
    try {
      await onUpdateItem(item.id, { user_sentences: next })
      setUserSentences(next)
      setSentenceDraft("")
      setShowAddSentence(false)
      toast.success("내 문장을 저장했어요")
    } catch {
      toast.error("문장 저장에 실패했어요")
    } finally {
      setSavingSentence(false)
    }
  }

  const body = (
    <div className={cn(variant === "list" ? "p-4" : "p-5 sm:p-6")}>
      {/* Word + badges */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className={cn("font-bold tracking-tight", variant === "full" ? "text-2xl" : "text-lg")}>
          {item.word}
        </h3>
        <span className={cn("rounded-full border px-2 py-0 text-[10px] font-medium leading-5", TYPE_COLORS[item.type] ?? TYPE_COLORS.word)}>
          {TYPE_LABELS[item.type] ?? item.type}
        </span>
        {item.source && item.source !== "manual" && (
          <span className={cn("rounded-full px-2 py-0 text-[10px] font-medium leading-5", SOURCE_COLORS[item.source] ?? "")}>
            {SOURCE_LABELS[item.source]}
          </span>
        )}
        {item.collection && (
          <span className="rounded-full border border-violet-400/40 bg-violet-50 px-2 py-0 text-[10px] font-medium leading-5 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
            {item.collection}
          </span>
        )}
        <button
          type="button"
          onClick={() => speak(item.word)}
          className="ml-auto text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          {speakingText === item.word
            ? <VolumeX className="h-4 w-4 animate-pulse text-primary" />
            : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Korean meaning */}
      {koreanText ? (
        <div className="mb-3">
          <SectionLabel>한국어 의미</SectionLabel>
          <p className="text-[15px] font-semibold leading-relaxed">{koreanText}</p>
        </div>
      ) : (
        <div className="mb-3">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onTranslate(item)}
            disabled={isTranslating}
          >
            {isTranslating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
            {isTranslating ? "번역 중…" : "한국어 번역"}
          </Button>
        </div>
      )}

      {/* Definition */}
      {item.definition && (
        <div className="mb-3">
          <SectionLabel>정의</SectionLabel>
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{item.definition}</p>
        </div>
      )}

      {/* Example sentence */}
      {item.example_sentence && (
        <div className="mb-3">
          <SectionLabel>예문</SectionLabel>
          <div className="flex items-start gap-2 rounded-xl border-l-2 border-primary/40 bg-muted/40 px-3 py-2">
            <p className="flex-1 text-sm italic leading-relaxed text-foreground/80">
              &ldquo;{item.example_sentence}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => speak(item.example_sentence!)}
              className="mt-0.5 shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              {speakingText === item.example_sentence
                ? <VolumeX className="h-3 w-3 animate-pulse text-primary" />
                : <Volume2 className="h-3 w-3" />}
            </button>
          </div>
        </div>
      )}

      {/* Context */}
      {item.context && (
        <div className="mb-3">
          <SectionLabel>맥락</SectionLabel>
          <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {item.context}
          </p>
        </div>
      )}

      {/* AI deep dive */}
      <div className="flex flex-wrap gap-1.5 border-t border-dashed border-border/40 pt-3">
        <button
          type="button"
          disabled={loadingExamples}
          onClick={() => void runDeepDive("examples")}
          className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {loadingExamples ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          예문 더 보기
        </button>
        <button
          type="button"
          disabled={loadingEtymology}
          onClick={() => void runDeepDive("etymology")}
          className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {loadingEtymology ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitBranch className="h-3 w-3" />}
          어원
        </button>
      </div>

      {aiError && <p className="mt-2 text-xs text-destructive">{aiError}</p>}

      {extraExamples && extraExamples.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {extraExamples.map((line, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground/80">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
              <span className="flex-1">{line}</span>
              <button type="button" onClick={() => speak(line)} className="mt-0.5 shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors">
                {speakingText === line ? <VolumeX className="h-3 w-3 animate-pulse text-primary" /> : <Volume2 className="h-3 w-3" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {(etymology || relatedForms) && (
        <div className="mt-2 space-y-1 text-[13px]">
          {etymology && <p className="leading-relaxed text-foreground/80">{etymology}</p>}
          {relatedForms && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Related: </span>{relatedForms}
            </p>
          )}
        </div>
      )}

      {userSentences.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <SectionLabel>내 문장</SectionLabel>
          {userSentences.map((s) => (
            <div key={s.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <p className="text-sm leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      )}

      {showAddSentence && (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          <Textarea
            value={sentenceDraft}
            onChange={(e) => {
              setSentenceDraft(e.target.value)
              setSentenceReview(null)
              setShowBetterReview(false)
            }}
            placeholder="나중에 쓸 영어 문장을 적어 보세요…"
            className="min-h-[72px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void handleSaveSentence()
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              disabled={!sentenceDraft.trim() || reviewingSentence}
              onClick={() => void handleReviewSentence()}
            >
              {reviewingSentence
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Sparkles className="h-3 w-3" />}
              AI 검토
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={!sentenceDraft.trim() || savingSentence}
              onClick={() => void handleSaveSentence()}
            >
              {savingSentence ? <Loader2 className="h-3 w-3 animate-spin" /> : "저장"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => {
                setShowAddSentence(false)
                setSentenceDraft("")
                setSentenceReview(null)
                setShowBetterReview(false)
              }}
            >
              취소
            </Button>
          </div>

          {sentenceReview && (
            <div className="space-y-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-bold",
                  sentenceReview.score >= 8
                    ? "bg-green-500/15 text-green-600 dark:text-green-400"
                    : sentenceReview.score >= 5
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground",
                )}>
                  <span className="text-base leading-none">{sentenceReview.score}</span>
                  <span className="text-[9px] opacity-70">/10</span>
                </div>
                <p className="flex-1 text-sm leading-relaxed">{sentenceReview.praise}</p>
              </div>

              {sentenceReview.tip && (
                <p className="rounded-lg border border-violet-500/15 bg-background/60 px-2.5 py-2 text-xs leading-relaxed text-foreground/80">
                  💡 {sentenceReview.tip}
                </p>
              )}

              {sentenceReview.corrections.length > 0 && (
                <div className="space-y-1.5">
                  {sentenceReview.corrections.map((c, i) => (
                    <div key={i} className="rounded-lg border border-border/50 bg-background/60 px-2.5 py-2">
                      <div className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="text-destructive line-through">{c.original}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{c.suggestion}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{c.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {sentenceReview.better_version && (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setShowBetterReview((p) => !p)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                  >
                    {showBetterReview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    모범 답안 {showBetterReview ? "숨기기" : "보기"}
                  </button>
                  {showBetterReview && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2">
                      <p className="text-sm italic leading-relaxed">{sentenceReview.better_version}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 text-[11px]"
                        onClick={() => {
                          setSentenceDraft(sentenceReview.better_version)
                          setSentenceReview(null)
                          setShowBetterReview(false)
                        }}
                      >
                        문장에 적용
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions footer — wrap on narrow screens */}
      <div className={cn("flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3", variant === "full" ? "mt-4" : "mt-3")}>
        <button
          type="button"
          onClick={() => onToggleMastered(item.id, item.is_mastered)}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-all",
            item.is_mastered
              ? "border-green-400/40 bg-green-500/10 text-green-600 dark:text-green-400"
              : "border-border/60 bg-muted/40 text-muted-foreground hover:border-green-400/40 hover:bg-green-500/10 hover:text-green-600"
          )}
        >
          {item.is_mastered
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            : <Circle className="h-3.5 w-3.5 shrink-0" />}
          <span className="whitespace-nowrap">{item.is_mastered ? "학습 완료" : "완료"}</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            void handleIncrementView()
          }}
          disabled={!onUpdateItem || incrementingView}
          title="복습 횟수 (완료와 별개)"
          className={cn(
            "relative flex shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium tabular-nums transition-all",
            viewCount > 0
              ? "border-sky-400/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
              : "border-border/60 bg-muted/40 text-muted-foreground hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-600",
            incrementingView && "opacity-70",
          )}
        >
          {incrementingView
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Eye className="h-3.5 w-3.5 shrink-0" />}
          <span className="whitespace-nowrap">봤어요</span>
          {viewCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold leading-none text-white">
              {viewCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowAddSentence((p) => !p)}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-all",
            showAddSentence
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-border/60 bg-muted/40 text-muted-foreground hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-700",
          )}
        >
          <PenLine className="h-3 w-3 shrink-0" />
          <span className="whitespace-nowrap">내 문장</span>
        </button>

        <button
          type="button"
          onClick={() => downloadVocabImage(item)}
          title="Instagram 이미지로 저장 (1080×1350)"
          className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <ImageDown className="h-3 w-3 shrink-0" />
          <span className="whitespace-nowrap">이미지</span>
        </button>
      </div>
    </div>
  )

  if (variant === "full") return body

  return (
    <div className={cn(
      "rounded-2xl border border-border/60 bg-card transition-all",
      item.is_mastered && "opacity-50"
    )}>
      {body}
    </div>
  )
}
