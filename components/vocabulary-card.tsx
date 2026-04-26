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
  phrasal_verb: "bg-chart-5/10 text-foreground border-chart-5/20",
  expression: "bg-chart-4/10 text-foreground border-chart-4/20",
}

const TYPE_LABELS: Record<string, string> = {
  word: "Word",
  idiom: "Idiom",
  phrasal_verb: "Phrasal Verb",
  expression: "Expression",
}

interface VocabularyCardProps {
  item: VocabularyItem
  onDelete: (id: string) => void
  onToggleMastered: (id: string, current: boolean) => void
  onTranslate: (item: VocabularyItem) => void
  isTranslating: boolean
}

export function VocabularyCard({
  item,
  onDelete,
  onToggleMastered,
  onTranslate,
  isTranslating,
}: VocabularyCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card
      className={cn(
        "transition-all duration-200 border",
        item.is_mastered && "opacity-60"
      )}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <span className="font-semibold text-foreground text-sm leading-tight break-words">
              {item.word}
            </span>
            <Badge
              variant="outline"
              className={cn("text-xs shrink-0", TYPE_COLORS[item.type] ?? TYPE_COLORS.word)}
            >
              {TYPE_LABELS[item.type] ?? item.type}
            </Badge>
            {item.korean_translation && (
              <Badge className="text-xs shrink-0 bg-korean text-korean-foreground border-0">
                {item.korean_translation}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onToggleMastered(item.id, item.is_mastered)}
              title={item.is_mastered ? "Mark as not mastered" : "Mark as mastered"}
            >
              {item.is_mastered ? (
                <CheckCircle2 className="h-4 w-4 text-accent" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {!item.korean_translation && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onTranslate(item)}
                disabled={isTranslating}
                title="Translate to Korean"
              >
                <Globe className={cn("h-4 w-4 text-muted-foreground", isTranslating && "animate-pulse")} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpanded(!expanded)}
              title="Toggle details"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onDelete(item.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
        {item.definition && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.definition}</p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-3 pt-0 space-y-2 border-t border-border mt-1">
          {item.example_sentence && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Example</p>
              <p className="text-xs text-foreground italic leading-relaxed">&ldquo;{item.example_sentence}&rdquo;</p>
            </div>
          )}
          {item.context && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">From transcript</p>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed bg-muted rounded px-2 py-1">{item.context}</p>
            </div>
          )}
          {item.korean_translation && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Korean</p>
              <p className="text-sm font-semibold" style={{ color: "oklch(var(--korean) / 1)" }}>
                {item.korean_translation}
              </p>
            </div>
          )}
          {!item.korean_translation && (
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
