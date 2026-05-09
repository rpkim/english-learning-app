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
        "group relative rounded-xl border border-border bg-card transition-all duration-150",
        "hover:border-border/80 hover:shadow-sm",
        item.is_mastered && "opacity-55"
      )}
    >
      {/* Card header */}
      <div className="flex items-start gap-2 px-3 py-2.5">
        {/* Left: word + badges */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold leading-snug text-foreground wrap-anywhere">
              {item.word}
            </span>
            <Badge
              variant="outline"
              className={cn("h-5 shrink-0 px-1.5 text-[10px] font-medium", TYPE_COLORS[item.type] ?? TYPE_COLORS.word)}
            >
              {TYPE_LABELS[item.type] ?? item.type}
            </Badge>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); speak(item.word) }}
              title="Speak word"
              className="inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              {speakingText === item.word
                ? <VolumeX className="h-3.5 w-3.5 animate-pulse text-primary" />
                : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          </div>
          {koreanTranslationText && (
            <span className="inline-flex max-w-full self-start rounded-md bg-korean/15 px-2 py-0.5 text-xs font-medium text-korean leading-snug wrap-anywhere">
              {koreanTranslationText}
            </span>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex shrink-0 items-center gap-0.5">
          {/* Mastered toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onToggleMastered(item.id, item.is_mastered)}
            title={item.is_mastered ? "Mark as not mastered" : "Mark as mastered"}
          >
            {item.is_mastered ? (
              <CheckCircle2 className="h-4 w-4 text-accent" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </Button>

          {/* Translate */}
          {!koreanTranslationText && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onTranslate(item)}
              disabled={isTranslating}
              title="Translate to Korean"
            >
              <Globe className={cn("h-4 w-4", isTranslating && "animate-pulse text-primary")} />
            </Button>
          )}

          {/* Expand */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
            title="Toggle details"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
            onClick={() => onDelete(item.id)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/60 px-3 pb-3 pt-2.5 space-y-3">
          {item.definition && (
            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Meaning</p>
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-line wrap-anywhere">
                {item.definition}
              </p>
            </div>
          )}

          {item.example_sentence && (
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Example</p>
                <button
                  type="button"
                  onClick={() => speak(item.example_sentence!)}
                  title="Speak example sentence"
                  className="inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                >
                  {speakingText === item.example_sentence
                    ? <VolumeX className="h-3 w-3 animate-pulse text-primary" />
                    : <Volume2 className="h-3 w-3" />}
                </button>
              </div>
              <p className="text-sm italic leading-relaxed text-foreground/80 wrap-anywhere">
                &ldquo;{item.example_sentence}&rdquo;
              </p>
            </div>
          )}

          {item.context && (
            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">From transcript</p>
              <p className="rounded-lg bg-muted/60 px-2.5 py-2 font-mono text-xs leading-relaxed text-muted-foreground wrap-anywhere">
                {item.context}
              </p>
            </div>
          )}

          {koreanTranslationText && (
            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Korean</p>
              <p className="text-base font-semibold text-korean wrap-anywhere">
                {koreanTranslationText}
              </p>
            </div>
          )}

          {!koreanTranslationText && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 text-xs"
              onClick={() => onTranslate(item)}
              disabled={isTranslating}
            >
              <Globe className="h-3.5 w-3.5" />
              {isTranslating ? "Translating…" : "Translate to Korean"}
            </Button>
          )}

          {/* AI deep dive */}
          <div className="space-y-2 border-t border-dashed border-border/60 pt-2.5">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">AI deeper dive</p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5 text-xs"
                disabled={loadingExamples}
                onClick={() => void runDeepDive("examples")}
              >
                {loadingExamples ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                More examples
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5 text-xs"
                disabled={loadingEtymology}
                onClick={() => void runDeepDive("etymology")}
              >
                {loadingEtymology ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
                Etymology
              </Button>
            </div>

            {aiError && <p className="text-xs text-destructive">{aiError}</p>}

            {extraExamples && extraExamples.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Extra examples</p>
                <ul className="space-y-1.5 text-sm">
                  {extraExamples.map((line, idx) => (
                    <li key={idx} className="flex items-start gap-2 wrap-anywhere leading-relaxed">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                      <span className="flex-1">{line}</span>
                      <button
                        type="button"
                        onClick={() => speak(line)}
                        title="Speak this example"
                        className="mt-0.5 shrink-0 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {speakingText === line
                          ? <VolumeX className="h-3 w-3 animate-pulse text-primary" />
                          : <Volume2 className="h-3 w-3" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(extraExamples) && extraExamples.length === 0 && !loadingExamples && (
              <p className="text-xs text-muted-foreground">No extra examples returned.</p>
            )}

            {(etymology || relatedForms) && (
              <div className="space-y-2">
                {etymology && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Etymology</p>
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap wrap-break-word">{etymology}</p>
                  </div>
                )}
                {relatedForms && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Related: </span>
                    {relatedForms}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
