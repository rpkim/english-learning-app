"use client"

import { Conversation } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { Clock, FileText, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConversationHistoryProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (conv: Conversation) => void
}

function formatDuration(seconds: number) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

export function ConversationHistory({ conversations, selectedId, onSelect }: ConversationHistoryProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
        <FileText className="h-8 w-8 opacity-30" />
        <p className="text-xs text-center">No sessions yet. Start recording to begin.</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 pr-2">
        {conversations.map((conv) => (
          <Button
            key={conv.id}
            variant="ghost"
            className={cn(
              "w-full justify-start h-auto py-2.5 px-3 flex flex-col items-start gap-1 text-left rounded-lg",
              selectedId === conv.id && "bg-primary/10 text-primary"
            )}
            onClick={() => onSelect(conv)}
          >
            <div className="flex items-center justify-between w-full gap-2">
              <span className="text-sm font-medium truncate flex-1">{conv.title}</span>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}</span>
              {formatDuration(conv.duration_seconds) && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(conv.duration_seconds)}
                </span>
              )}
            </div>
          </Button>
        ))}
      </div>
    </ScrollArea>
  )
}
