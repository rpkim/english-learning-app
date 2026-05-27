"use client"

import { useState } from "react"
import { VocabularyItem } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ChevronDown, ChevronUp, Globe, Trash2, Circle, Sparkles, GitBranch, Loader2, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTts } from "@/hooks/use-tts"

const TYPE_COLORS: Record<string, string> = {
  word: "bg-primary/10 text-primary border-primary/20",
  idiom: "bg-accent/10 text-accent-foreground border-accent/20",
  slang: "bg-orange-500/10 text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-600/40",
  phrasal_verb: "bg-accent/10 text-accent-foreground border-accent/20",
  expression: "bg-purple-500/10 text-purple-600 border-purple-200 dark:text-purple-400 dark:border-purple-600/40",
}

const TYPE_LABELS: Record<string, string> = {
  word: "Word",
  idiom: "Idiom",
  slang: "Slang",
  phrasal_verb: "Phrasal verb",
  expression: "Expression",
}

interface VocabularyCardProps {
  item: VocabularyItem
  onDelete: (id: string) => void
  onToggleMastered: (id: string, current: boolean) => void
  onTranslate: (item: VocabularyItem) => void
  isTranslating: boolean
}

function getKoreanTranslationText(raw: unknown): string {
  if (typeof raw === "string") return raw
  if (!raw || typeof raw !== "object") return ""
  const translationObj = raw as Record<string, unknown>
  if (typeof translationObj.korean_translation === "string") return translationObj.korean_translation
  if (typeof translationObj.meaning === "string") return translationObj.meaning
  return typeof translationObj.usage === "string" ? translationObj.usage : ""
}

export function VocabularyCard({
  item,
  onDelete,
  onToggleMastered,
  onTranslate,
  isTranslating,
}: VocabularyCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [extraExamples, setExtraExamples] = useState<string[] | null>(null)
  const { speak, speakingText } = useTts()
  const [etymology, setEtymology] = useState<string | null>(null)
  const [relatedForms, setRelatedForms] = useState<string | null>(null)
  const [loadingExamples, setLoadingExamples] = useState(false)
  const [loadingEtymology, setLoadingEtymology] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const koreanTranslationText = getKoreanTranslationText(item.korean_translation)

  const runDeepDive = async (mode: "examples" | "etymology") => {
    setAiError(null)
    if (mode === "examples") setLoadingExamples(true)
    else setLoadingEtymology(true)
    try {
      const res = await fetch("/api/vocabulary-deep-dive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: item.word,
          type: item.type,
          definition: item.definition ?? "",
          example_sentence: item.example_sentence ?? "",
          context: item.context ?? "",
          mode,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAiError(typeof data?.error === "string" ? data.error : "Could not load AI content")
        return
      }
      if (mode === "examples") {
        const ex = Array.isArray(data?.extra_examples)
          ? data.extra_examples.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
          : []
        setExtraExamples(ex.length ? ex : [])
      } else {
        setEtymology(typeof data?.etymology === "string" ? data.etymology : "")
        setRelatedForms(typeof data?.related_forms === "string" ? data.related_forms : "")
      }
    } catch {
      setAiError("Network error")
    } finally {
      if (mode === "examples") setLoadingExamples(false)
      else setLoadingEtymology(false)
    }
  }

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border/60 bg-card transition-all duration-150",
        "hover:border-border hover:bg-muted/20",
        item.is_mastered && "opacity-50"
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Left: word + type badge + korean */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold leading-snug text-foreground wrap-anywhere">
              {item.word}
            </span>
            <span className={cn("shrink-0 rounded-full border px-2 py-0 text-[10px] font-medium leading-5", TYPE_COLORS[item.type] ?? TYPE_COLORS.word)}>
              {TYPE_LABELS[item.type] ?? item.type}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); speak(item.word) }}
              title="Speak"
              className="inline-flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              {speakingText === item.word
                ? <VolumeX className="h-3 w-3 animate-pulse text-primary" />
                : <Volume2 className="h-3 w-3" />}
            </button>
          </div>
          {koreanTranslationText && (
            <span className="text-xs text-muted-foreground leading-snug wrap-anywhere">
              {koreanTranslationText}
            </span>
          )}
        </div>

        {/* Right: compact actions */}
        <div className="flex shrink-0 items-center">
          {/* Mastered toggle */}
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onToggleMastered(item.id, item.is_mastered)}
            title={item.is_mastered ? "Unmark mastered" : "Mark mastered"}
          >
            {item.is_mastered
              ? <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
              : <Circle className="h-4 w-4" />}
          </button>

          {/* Expand */}
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {/* Delete — hover only */}
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
            onClick={() => onDelete(item.id)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/40 px-3 pb-3 pt-2.5 space-y-2.5">
          {item.definition && (
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line wrap-anywhere">
              {item.definition}
            </p>
          )}

          {item.example_sentence && (
            <div className="flex items-start gap-1.5">
              <p className="flex-1 text-[13px] italic leading-relaxed text-muted-foreground wrap-anywhere">
                &ldquo;{item.example_sentence}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => speak(item.example_sentence!)}
                className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                {speakingText === item.example_sentence
                  ? <VolumeX className="h-3 w-3 animate-pulse text-primary" />
                  : <Volume2 className="h-3 w-3" />}
              </button>
            </div>
          )}

          {item.context && (
            <p className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground wrap-anywhere">
              {item.context}
            </p>
          )}

          {/* Korean + translate */}
          {koreanTranslationText ? (
            <p className="text-sm font-medium text-korean wrap-anywhere">{koreanTranslationText}</p>
          ) : (
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
          )}

          {/* AI deep dive */}
          <div className="flex flex-wrap gap-1.5 border-t border-dashed border-border/40 pt-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              disabled={loadingExamples}
              onClick={() => void runDeepDive("examples")}
            >
              {loadingExamples ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              예문 더 보기
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              disabled={loadingEtymology}
              onClick={() => void runDeepDive("etymology")}
            >
              {loadingEtymology ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitBranch className="h-3 w-3" />}
              어원
            </Button>
          </div>

          {aiError && <p className="text-xs text-destructive">{aiError}</p>}

          {extraExamples && extraExamples.length > 0 && (
            <ul className="space-y-1.5 text-[13px]">
              {extraExamples.map((line, idx) => (
                <li key={idx} className="flex items-start gap-2 wrap-anywhere leading-relaxed text-foreground/80">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                  <span className="flex-1">{line}</span>
                  <button
                    type="button"
                    onClick={() => speak(line)}
                    className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    {speakingText === line
                      ? <VolumeX className="h-3 w-3 animate-pulse text-primary" />
                      : <Volume2 className="h-3 w-3" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(etymology || relatedForms) && (
            <div className="space-y-1.5 text-[13px]">
              {etymology && <p className="leading-relaxed text-foreground/80 wrap-break-word">{etymology}</p>}
              {relatedForms && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">Related: </span>{relatedForms}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
