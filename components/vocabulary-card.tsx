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
}

const TYPE_LABELS: Record<string, string> = {
  word: "Word",
  idiom: "Idiom",
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
        "transition-all duration-200 border rounded-lg py-1 gap-0",
        item.is_mastered && "opacity-60"
      )}
    >
      <CardHeader className="py-0 px-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
            <span className="font-semibold text-foreground text-sm leading-none break-words">
              {item.word}
            </span>
            <Badge
              variant="outline"
              className={cn("text-xs h-4 px-1.5 shrink-0", TYPE_COLORS[item.type] ?? TYPE_COLORS.word)}
            >
              {TYPE_LABELS[item.type] ?? item.type}
            </Badge>
            </div>
            {item.korean_translation && (
              <Badge className="text-xs h-4 px-1.5 w-fit max-w-full bg-korean text-korean-foreground border-0 overflow-hidden text-ellipsis whitespace-nowrap">
                {item.korean_translation}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0 self-start">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onToggleMastered(item.id, item.is_mastered)}
              title={item.is_mastered ? "Mark as not mastered" : "Mark as mastered"}
            >
              {item.is_mastered ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
            {!item.korean_translation && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
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
              className="h-5 w-5"
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
              className="h-5 w-5"
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
              <p className="text-sm font-semibold text-korean">
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
