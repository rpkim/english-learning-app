"use client"

import { useState } from "react"
import { VocabularyItem } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { CheckCircle2, ChevronDown, ChevronUp, Globe, Trash2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"

const TYPE_COLORS: Record<string, string> = {
  word: "bg-primary/10 text-primary border-primary/20",
  idiom: "bg-accent/10 text-accent-foreground border-accent/20",
  slang: "bg-orange-500/10 text-orange-700 border-orange-300",
}

const TYPE_LABELS: Record<string, string> = {
  word: "Word",
  idiom: "Idiom",
  slang: "Slang",
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

  const usage = typeof translationObj.usage === "string" ? translationObj.usage : ""
  return usage
}

export function VocabularyCard({
  item,
  onDelete,
  onToggleMastered,
  onTranslate,
  isTranslating,
}: VocabularyCardProps) {
  const [expanded, setExpanded] = useState(false)
  const koreanTranslationText = getKoreanTranslationText(item.korean_translation)

  return (
    <Card
      className={cn(
        "transition-all duration-200 border rounded-lg py-1 gap-0",
        item.is_mastered && "opacity-60"
      )}
    >
      <CardHeader className="py-0 px-2 overflow-hidden">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex flex-col gap-0.5 flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
            <span className="font-semibold text-foreground text-sm leading-snug break-words [overflow-wrap:anywhere]">
              {item.word}
            </span>
            <Badge
              variant="outline"
              className={cn("text-xs h-4 px-1.5 shrink-0", TYPE_COLORS[item.type] ?? TYPE_COLORS.word)}
            >
              {TYPE_LABELS[item.type] ?? item.type}
            </Badge>
            </div>
            {koreanTranslationText && (
              <Badge className="text-xs min-h-4 h-auto py-0.5 px-1.5 max-w-full min-w-0 self-start bg-korean text-korean-foreground border-0 break-words [overflow-wrap:anywhere] whitespace-normal text-left leading-snug">
                {koreanTranslationText}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0 self-start sticky top-0 bg-card/95 backdrop-blur-sm rounded-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-5 sm:w-5"
              onClick={() => onToggleMastered(item.id, item.is_mastered)}
              title={item.is_mastered ? "Mark as not mastered" : "Mark as mastered"}
            >
              {item.is_mastered ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
            {!koreanTranslationText && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-5 sm:w-5"
                onClick={() => onTranslate(item)}
                disabled={isTranslating}
                title="Translate to Korean"
              >
                <Globe className={cn("h-3.5 w-3.5 text-muted-foreground", isTranslating && "animate-pulse")} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-5 sm:w-5"
              onClick={() => setExpanded(!expanded)}
              title="Toggle details"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-5 sm:w-5"
              onClick={() => onDelete(item.id)}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-1.5 pb-0 pt-0 space-y-0.5 border-t border-border mt-0">
          {item.definition && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Meaning</p>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere]">{item.definition}</p>
            </div>
          )}
          {item.example_sentence && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Example</p>
              <p className="text-xs text-foreground italic leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere]">&ldquo;{item.example_sentence}&rdquo;</p>
            </div>
          )}
          {item.context && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">From transcript</p>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed bg-muted rounded px-2 py-1 break-words [overflow-wrap:anywhere]">{item.context}</p>
            </div>
          )}
          {koreanTranslationText && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Korean</p>
              <p className="text-sm font-semibold text-korean break-words [overflow-wrap:anywhere]">
                {koreanTranslationText}
              </p>
            </div>
          )}
          {!koreanTranslationText && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7 gap-1"
              onClick={() => onTranslate(item)}
              disabled={isTranslating}
            >
              <Globe className="h-3 w-3" />
              {isTranslating ? "Translating..." : "Translate to Korean"}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}
