"use client"

import { Conversation } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { Clock, FileText, ChevronRight, Pencil, Trash2, FolderPlus, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"
import { ConversationGroup } from "@/lib/types"

interface ConversationHistoryProps {
  conversations: Conversation[]
  groups: ConversationGroup[]
  selectedGroupId: string | null
  selectedId: string | null
  onSelect: (conv: Conversation) => void
  onRename: (conv: Conversation, nextTitle: string) => void | Promise<void>
  onDelete: (conv: Conversation) => void | Promise<void>
  onCreateGroup: (name: string, conversationIds: string[]) => void | Promise<void>
  onDeleteGroup: (groupId: string) => void | Promise<void>
  onSelectGroup: (groupId: string | null) => void
}

function formatDuration(seconds: number) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

export function ConversationHistory({
  conversations,
  groups,
  selectedGroupId,
  selectedId,
  onSelect,
  onRename,
  onDelete,
  onCreateGroup,
  onDeleteGroup,
  onSelectGroup,
}: ConversationHistoryProps) {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([])

  const visibleConversations = useMemo(() => {
    if (!selectedGroupId) return conversations
    const group = groups.find((g) => g.id === selectedGroupId)
    if (!group) return conversations
    const set = new Set(group.conversation_ids)
    return conversations.filter((c) => set.has(c.id))
  }, [conversations, groups, selectedGroupId])

  const toggleSelected = (id: string) => {
    setSelectedConversationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleCreateGroup = async () => {
    if (selectedConversationIds.length < 2) return
    const defaultName = `Group ${new Date().toLocaleDateString()}`
    const name = window.prompt("Group name", defaultName)
    if (!name || !name.trim()) return
    await onCreateGroup(name.trim(), selectedConversationIds)
    setSelectedConversationIds([])
    setSelectionMode(false)
  }

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
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              size="sm"
              variant={selectedGroupId === null ? "secondary" : "ghost"}
              className="h-6 text-[11px] px-2"
              onClick={() => onSelectGroup(null)}
            >
              All
            </Button>
            {groups.map((group) => (
              <div key={group.id} className="flex items-center gap-0.5">
                <Button
                  size="sm"
                  variant={selectedGroupId === group.id ? "secondary" : "ghost"}
                  className="h-6 text-[11px] px-2"
                  onClick={() => onSelectGroup(group.id)}
                  title={group.name}
                >
                  {group.name}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => void onDeleteGroup(group.id)}
                  title="Delete group"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={selectionMode ? "secondary" : "outline"}
              className="h-6 text-[11px] px-2"
              onClick={() => {
                setSelectionMode((v) => !v)
                setSelectedConversationIds([])
              }}
            >
              Select
            </Button>
            {selectionMode && (
              <Button
                size="sm"
                className="h-6 text-[11px] px-2 gap-1"
                onClick={() => void handleCreateGroup()}
                disabled={selectedConversationIds.length < 2}
              >
                <FolderPlus className="h-3 w-3" />
                Group
              </Button>
            )}
          </div>
        </div>

        {visibleConversations.map((conv) => (
          <div
            key={conv.id}
            role="button"
            tabIndex={0}
            className={cn(
              "w-full h-auto py-2.5 px-3 flex flex-col items-start gap-1 text-left rounded-lg cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedId === conv.id && "bg-primary/10 text-primary"
            )}
            onClick={() => {
              if (selectionMode) {
                toggleSelected(conv.id)
                return
              }
              onSelect(conv)
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return
              e.preventDefault()
              if (selectionMode) {
                toggleSelected(conv.id)
                return
              }
              onSelect(conv)
            }}
          >
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {selectionMode && (
                  <span className={cn(
                    "inline-flex h-4 w-4 items-center justify-center rounded border",
                    selectedConversationIds.includes(conv.id) ? "bg-primary border-primary text-primary-foreground" : "border-border"
                  )}>
                    {selectedConversationIds.includes(conv.id) && <Check className="h-3 w-3" />}
                  </span>
                )}
                <span className="text-sm font-medium truncate flex-1">{conv.title}</span>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation()
                    const nextTitle = window.prompt("Edit session title", conv.title)
                    if (!nextTitle) return
                    const trimmed = nextTitle.trim()
                    if (!trimmed || trimmed === conv.title) return
                    void onRename(conv, trimmed)
                  }}
                  title="Rename session"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation()
                    const ok = window.confirm(`Delete "${conv.title}"? This cannot be undone.`)
                    if (!ok) return
                    void onDelete(conv)
                  }}
                  title="Delete session"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </Button>
                {!selectionMode && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}</span>
              {formatDuration(conv.duration_seconds) && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(conv.duration_seconds)}
                </span>
              )}
              {groups.some((g) => g.conversation_ids.includes(conv.id)) && (
                <Badge variant="outline" className="h-4 px-1 text-[10px]">Grouped</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
