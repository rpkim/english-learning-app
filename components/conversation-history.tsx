"use client"

import { Conversation, ConversationGroup } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { Clock, FileText, ChevronRight, Pencil, Trash2, FolderPlus, FolderPen } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"

interface ConversationHistoryProps {
  conversations: Conversation[]
  groups: ConversationGroup[]
  selectedGroupId: string | null
  selectedId: string | null
  onSelect: (conv: Conversation) => void
  onRename: (conv: Conversation, nextTitle: string) => void | Promise<void>
  onDelete: (conv: Conversation) => void | Promise<void>
  onCreateGroup: (name: string) => void | Promise<void>
  onRenameGroup: (groupId: string, nextName: string) => void | Promise<void>
  onDeleteGroup: (groupId: string) => void | Promise<void>
  onSelectGroup: (groupId: string | null) => void
  onMoveConversationToGroup: (conversationId: string, groupId: string | null) => void | Promise<void>
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
  onRenameGroup,
  onDeleteGroup,
  onSelectGroup,
  onMoveConversationToGroup,
}: ConversationHistoryProps) {
  const [draggingConversationId, setDraggingConversationId] = useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)

  const groupedConversationIds = useMemo(
    () => new Set(groups.flatMap((g) => g.conversation_ids)),
    [groups]
  )
  const unclassifiedConversations = useMemo(
    () => conversations.filter((c) => !groupedConversationIds.has(c.id)),
    [conversations, groupedConversationIds]
  )
  const groupedSections = useMemo(
    () =>
      groups.map((g) => {
        const set = new Set(g.conversation_ids)
        return { group: g, conversations: conversations.filter((c) => set.has(c.id)) }
      }),
    [groups, conversations]
  )

  const handleCreateGroup = async () => {
    const defaultName = `Workspace ${new Date().toLocaleDateString()}`
    const name = window.prompt("Workspace name", defaultName)
    if (!name || !name.trim()) return
    await onCreateGroup(name.trim())
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
      <div className="flex flex-col gap-2 pr-2">
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <div className="text-xs text-muted-foreground">Drag sessions between workspaces.</div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] px-2"
              onClick={() => void handleCreateGroup()}
            >
              <FolderPlus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        <Section
          title="Unclassified"
          count={unclassifiedConversations.length}
          selected={selectedGroupId === "__ungrouped__"}
          dragActive={dragOverGroupId === "__ungrouped__"}
          onSelect={() => onSelectGroup("__ungrouped__")}
          onDragOver={(e) => {
            if (!draggingConversationId) return
            e.preventDefault()
            setDragOverGroupId("__ungrouped__")
          }}
          onDragLeave={() => {
            if (dragOverGroupId === "__ungrouped__") setDragOverGroupId(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            const conversationId = e.dataTransfer.getData("text/conversation-id") || draggingConversationId
            if (!conversationId) return
            void onMoveConversationToGroup(conversationId, null)
            setDraggingConversationId(null)
            setDragOverGroupId(null)
          }}
        >
          {unclassifiedConversations.map((conv) => renderRow(conv))}
        </Section>

        {groupedSections.map(({ group, conversations: inGroup }) => (
          <Section
            key={group.id}
            title={group.name}
            count={inGroup.length}
            selected={selectedGroupId === group.id}
            dragActive={dragOverGroupId === group.id}
            onSelect={() => onSelectGroup(group.id)}
            onRename={() => {
              const nextName = window.prompt("Edit workspace name", group.name)
              if (!nextName) return
              const trimmed = nextName.trim()
              if (!trimmed || trimmed === group.name) return
              void onRenameGroup(group.id, trimmed)
            }}
            onDelete={() => void onDeleteGroup(group.id)}
            onDragOver={(e) => {
              if (!draggingConversationId) return
              e.preventDefault()
              setDragOverGroupId(group.id)
            }}
            onDragLeave={() => {
              if (dragOverGroupId === group.id) setDragOverGroupId(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              const conversationId = e.dataTransfer.getData("text/conversation-id") || draggingConversationId
              if (!conversationId) return
              void onMoveConversationToGroup(conversationId, group.id)
              setDraggingConversationId(null)
              setDragOverGroupId(null)
            }}
          >
            {inGroup.map((conv) => renderRow(conv))}
          </Section>
        ))}
      </div>
    </ScrollArea>
  )

  function renderRow(conv: Conversation) {
    return (
      <div
        key={conv.id}
        role="button"
        tabIndex={0}
        className={cn(
          "w-full h-auto py-2.5 px-3 flex flex-col items-start gap-1 text-left rounded-lg cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-transparent",
          selectedId === conv.id && "bg-primary/10 text-primary border-primary/30",
          groupedConversationIds.has(conv.id) && "bg-card/60 border-border"
        )}
        draggable
        onDragStart={(e) => {
          setDraggingConversationId(conv.id)
          e.dataTransfer.setData("text/conversation-id", conv.id)
          e.dataTransfer.effectAllowed = "move"
        }}
        onDragEnd={() => {
          setDraggingConversationId(null)
          setDragOverGroupId(null)
        }}
        onClick={() => {
          onSelect(conv)
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return
          e.preventDefault()
          onSelect(conv)
        }}
      >
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
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
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
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
            <Badge variant="outline" className="h-4 px-1 text-[10px] border-primary/30 bg-primary/5 text-primary">
              Grouped
            </Badge>
          )}
        </div>
      </div>
    )
  }
}

interface SectionProps {
  title: string
  count: number
  selected: boolean
  dragActive: boolean
  children: React.ReactNode
  onSelect: () => void
  onRename?: () => void
  onDelete?: () => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
}

function Section({
  title,
  count,
  selected,
  dragActive,
  children,
  onSelect,
  onRename,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: SectionProps) {
  return (
    <div className={cn("rounded-lg border px-2 py-1", selected ? "border-primary/40 bg-primary/5" : "border-border/60")}>
      <div
        className={cn(
          "flex items-center justify-between rounded-md px-1 py-1 cursor-pointer",
          selected && "text-primary font-semibold",
          dragActive && "bg-primary/15 ring-1 ring-primary/40"
        )}
        onClick={onSelect}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="text-sm">{title}</div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="h-4 px-1 text-[10px]">{count}</Badge>
          {onRename && (
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation()
                onRename()
              }}
              title="Rename workspace"
            >
              <FolderPen className="h-3 w-3 text-muted-foreground" />
            </Button>
          )}
          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              title="Delete group"
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
      <div className="ml-3 mt-1 border-l border-dashed border-border/70 pl-2 flex flex-col gap-1">
        {children}
      </div>
    </div>
  )
}
