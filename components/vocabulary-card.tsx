"use client"

import { useState } from "react"
import { VocabularyItem } from "@/lib/types"
import { CheckCircle2, Circle, Trash2, Volume2, VolumeX, Sparkles, GitBranch, Loader2, Globe, ImageDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTts } from "@/hooks/use-tts"
import { Button } from "@/components/ui/button"
import { downloadVocabImage } from "@/lib/vocab-image"

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
  onDelete: (id: string) => void
  onToggleMastered: (id: string, current: boolean) => void
  onTranslate: (item: VocabularyItem) => void
  isTranslating: boolean
  /** Compact = list view. Full = deck view (no border, renders inline). */
  variant?: "list" | "full"
}

export function VocabularyCard({
  item,
  onDelete,
  onToggleMastered,
  onTranslate,
  isTranslating,
  variant = "list",
}: VocabularyCardProps) {
  const { speak, speakingText } = useTts()
  const [extraExamples, setExtraExamples] = useState<string[] | null>(null)
  const [etymology, setEtymology] = useState<string | null>(null)
  const [relatedForms, setRelatedForms] = useState<string | null>(null)
  const [loadingExamples, setLoadingExamples] = useState(false)
  const [loadingEtymology, setLoadingEtymology] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

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
      } else {
        setEtymology(data?.etymology ?? "")
        setRelatedForms(data?.related_forms ?? "")
      }
    } catch { setAiError("Network error") }
    finally {
      if (mode === "examples") setLoadingExamples(false)
      else setLoadingEtymology(false)
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

      {/* Actions footer */}
      <div className={cn("flex items-center gap-2 border-t border-border/40 pt-3", variant === "full" ? "mt-4" : "mt-3")}>
        <button
          type="button"
          onClick={() => onToggleMastered(item.id, item.is_mastered)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all",
            item.is_mastered
              ? "border-green-400/40 bg-green-500/10 text-green-600 dark:text-green-400"
              : "border-border/60 bg-muted/40 text-muted-foreground hover:border-green-400/40 hover:bg-green-500/10 hover:text-green-600"
          )}
        >
          {item.is_mastered
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <Circle className="h-3.5 w-3.5" />}
          {item.is_mastered ? "학습 완료" : "완료 표시"}
        </button>

        {/* Download as Instagram image */}
        <button
          type="button"
          onClick={() => downloadVocabImage(item)}
          title="Instagram 이미지로 저장 (1080×1350)"
          className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <ImageDown className="h-3 w-3" />
          이미지
        </button>

        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="ml-auto flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
          삭제
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
