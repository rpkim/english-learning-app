"use client"

import { useState } from "react"
import { Conversation, ConversationGroup, VocabularyItem } from "@/lib/types"
import { VocabularyCard } from "@/components/vocabulary-card"
import { ConversationHistory } from "@/components/conversation-history"
import { TutorChatPanel } from "@/components/tutor-chat-panel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BookOpen,
  History,
  Plus,
  Globe,
  FileDown,
  Loader2,
  EyeOff,
  PanelRightClose,
  PanelLeftOpen,
  MessageCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface LibraryColumnProps {
  className?: string
  variant?: "split" | "solo"
  onCollapseRight?: () => void
  leftCollapsed?: boolean
  onExpandLeft?: () => void
  /** Externally controlled active tab (for mobile bottom nav) */
  activeTab?: "vocabulary" | "history" | "tutor"
  /** Hide the inner tab bar (when bottom nav handles navigation) */
  hideTabs?: boolean
  scopedVocabulary: VocabularyItem[]
  conversations: Conversation[]
  conversationGroups: ConversationGroup[]
  selectedGroupId: string | null
  selectedConversationId: string | null
  onSelectConversation: (conv: Conversation) => void | Promise<void>
  onRenameConversation: (conv: Conversation, nextTitle: string) => void | Promise<void>
  onDeleteConversation: (conv: Conversation) => void | Promise<void>
  onCreateGroup: (name: string) => void | Promise<void>
  onRenameGroup: (groupId: string, nextName: string) => void | Promise<void>
  onDeleteGroup: (groupId: string) => void | Promise<void>
  onArchiveGroup: (groupId: string) => void | Promise<void>
  onRestoreGroup: (groupId: string) => void | Promise<void>
  onSelectGroup: (groupId: string | null) => void
  onMoveConversationToGroup: (conversationId: string, groupId: string | null) => void | Promise<void>
  workspaceStats: Record<string, { totalWords: number; masteredWords: number }>
  vocabView: "items" | "frequency"
  setVocabView: (v: "items" | "frequency") => void
  vocabFilter: "all" | "word" | "idiom" | "slang"
  setVocabFilter: (f: "all" | "word" | "idiom" | "slang") => void
  wordCount: number
  idiomCount: number
  slangCount: number
  filteredVocabulary: VocabularyItem[]
  frequentWords: { word: string; count: number }[]
  isLoadingVocab: boolean
  isBatchTranslating: boolean
  isExportingPdf: boolean
  masteredCount: number
  onShowAllVocabulary: () => void
  onExportCsv: () => void
  onExportPdf: () => void | Promise<void>
  onShowManualAdd: () => void
  onTranslateScoped: () => void | Promise<void>
  onDeleteVocab: (id: string) => void | Promise<void>
  onToggleMastered: (id: string, current: boolean) => void | Promise<void>
  onTranslate: (item: VocabularyItem) => void | Promise<void>
  translatingId: string | null
  onAddFrequentWord: (word: string) => void | Promise<void>
  onExcludeTopWord: (word: string) => void
  tutorTranscriptContext: string
}

export function LibraryColumn({
  className,
  variant = "split",
  onCollapseRight,
  leftCollapsed,
  onExpandLeft,
  activeTab,
  hideTabs = false,
  scopedVocabulary,
  conversations,
  conversationGroups,
  selectedGroupId,
  selectedConversationId,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onArchiveGroup,
  onRestoreGroup,
  onSelectGroup,
  onMoveConversationToGroup,
  workspaceStats,
  vocabView,
  setVocabView,
  vocabFilter,
  setVocabFilter,
  wordCount,
  idiomCount,
  slangCount,
  filteredVocabulary,
  frequentWords,
  isLoadingVocab,
  isBatchTranslating,
  isExportingPdf,
  masteredCount,
  onShowAllVocabulary,
  onExportCsv,
  onExportPdf,
  onShowManualAdd,
  onTranslateScoped,
  onDeleteVocab,
  onToggleMastered,
  onTranslate,
  translatingId,
  onAddFrequentWord,
  onExcludeTopWord,
  tutorTranscriptContext,
}: LibraryColumnProps) {
  const [localTab, setLocalTab] = useState<"vocabulary" | "history" | "tutor">("vocabulary")
  const effectiveTab = activeTab ?? localTab

  const scopeLabel =
    selectedConversationId
      ? "This recording"
      : selectedGroupId === "__ungrouped__"
        ? "Inbox (ungrouped)"
        : selectedGroupId
          ? "This folder"
          : "All saved words"

  const tabBar = hideTabs ? null : (
    <div className="border-border shrink-0 border-b px-3 pt-2 sm:px-4">
      {/* Panel controls row */}
      {(onCollapseRight || (leftCollapsed && onExpandLeft)) && (
        <div className="mb-2 flex items-center gap-1 justify-end">
          {leftCollapsed && onExpandLeft && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onExpandLeft}
              title="Expand transcribe panel"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </Button>
          )}
          {onCollapseRight && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onCollapseRight}
              title="Collapse study panel"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      <TabsList className="grid h-auto w-full grid-cols-3 gap-0.5 rounded-xl bg-muted/50 p-1">
        <TabsTrigger
          value="vocabulary"
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm sm:gap-1.5 sm:px-3"
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Words</span>
          {scopedVocabulary.length > 0 && (
            <Badge
              variant="secondary"
              className="h-4 min-w-4 rounded-full px-1 text-[9px] leading-none sm:text-[10px]"
            >
              {scopedVocabulary.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm sm:gap-1.5 sm:px-3"
        >
          <History className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Sessions</span>
          {conversations.length > 0 && (
            <Badge
              variant="secondary"
              className="h-4 min-w-4 rounded-full px-1 text-[9px] leading-none sm:text-[10px]"
            >
              {conversations.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="tutor"
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm sm:gap-1.5 sm:px-3"
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Tutor</span>
        </TabsTrigger>
      </TabsList>
    </div>
  )

  const vocabToolbar = (
    <div className="border-border flex min-w-0 shrink-0 flex-col gap-2.5 border-b px-3 py-3 sm:px-4">
      {/* Scope + filter row */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{scopeLabel}</p>
          {selectedConversationId && (
            <button
              onClick={onShowAllVocabulary}
              className="mt-0.5 text-[11px] text-primary hover:underline"
            >
              Clear filter →
            </button>
          )}
        </div>
        {masteredCount > 0 && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {masteredCount}/{scopedVocabulary.length} mastered
          </span>
        )}
      </div>

      {/* Type filter chips */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {/* View toggle */}
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
          <Button
            variant={vocabView === "items" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 rounded-md px-2.5 text-xs"
            onClick={() => setVocabView("items")}
          >
            Items
          </Button>
          <Button
            variant={vocabView === "frequency" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 rounded-md px-2.5 text-xs"
            onClick={() => setVocabView("frequency")}
          >
            Top words
          </Button>
        </div>

        <div className="h-4 w-px bg-border/60 shrink-0" />

        {/* Type filter */}
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
          {(
            [
              { key: "all", label: `All ${scopedVocabulary.length}` },
              { key: "word", label: `Words ${wordCount}` },
              { key: "idiom", label: `Idioms ${idiomCount}` },
              { key: "slang", label: `Slang ${slangCount}` },
            ] as const
          ).map(({ key, label }) => (
            <Button
              key={key}
              variant={vocabFilter === key ? "secondary" : "ghost"}
              size="sm"
              className="h-7 rounded-md px-2 text-xs"
              onClick={() => setVocabFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Action row */}
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onShowManualAdd}
        >
          <Plus className="h-3.5 w-3.5" />
          Add word
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => void onTranslateScoped()}
          disabled={isBatchTranslating}
          title="Translate all untranslated in current scope"
        >
          {isBatchTranslating ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <Globe className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">Translate all</span>
        </Button>
        <div className="h-4 w-px bg-border/60 shrink-0" />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onExportCsv}
          title="Export as CSV"
        >
          <FileDown className="h-3.5 w-3.5" />
          CSV
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => void onExportPdf()}
          disabled={isExportingPdf}
          title="Export as PDF"
        >
          {isExportingPdf ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          PDF
        </Button>
      </div>
    </div>
  )

  const vocabBody = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
      <div className={cn("flex flex-col gap-1.5 p-2.5", hideTabs ? "pb-20" : "pb-[max(1rem,env(safe-area-inset-bottom))]")}>
        {isLoadingVocab ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : vocabView === "items" && filteredVocabulary.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <BookOpen className="h-10 w-10 opacity-20" />
            <p className="max-w-[20ch] text-center text-sm leading-relaxed text-balance">
              No vocabulary items yet. Start a session to extract words.
            </p>
          </div>
        ) : vocabView === "items" ? (
          <>
            {filteredVocabulary.map((item) => (
              <VocabularyCard
                key={item.id}
                item={item}
                onDelete={onDeleteVocab}
                onToggleMastered={onToggleMastered}
                onTranslate={onTranslate}
                isTranslating={translatingId === item.id}
              />
            ))}
          </>
        ) : frequentWords.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <BookOpen className="h-10 w-10 opacity-20" />
            <p className="text-center text-sm leading-relaxed">No frequent words in this scope yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {frequentWords.map((item) => (
              <div
                key={item.word}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 text-sm font-medium break-all sm:break-normal sm:truncate">
                    {item.word}
                  </span>
                  <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] tabular-nums">
                    ×{item.count}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    onClick={() => void onAddFrequentWord(item.word)}
                  >
                    + Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => onExcludeTopWord(item.word)}
                    title="Exclude from top words"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const historyBody = (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-3", hideTabs && "pb-20")}>
      <ConversationHistory
        conversations={conversations}
        groups={conversationGroups}
        selectedGroupId={selectedGroupId}
        selectedId={selectedConversationId}
        onSelect={onSelectConversation}
        onRename={onRenameConversation}
        onDelete={onDeleteConversation}
        onCreateGroup={onCreateGroup}
        onRenameGroup={onRenameGroup}
        onDeleteGroup={onDeleteGroup}
        onArchiveGroup={onArchiveGroup}
        onRestoreGroup={onRestoreGroup}
        onSelectGroup={onSelectGroup}
        onMoveConversationToGroup={onMoveConversationToGroup}
        workspaceStats={workspaceStats}
      />
    </div>
  )

  return (
    <div
      className={cn(
        "border-border flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        variant === "split" ? "border-l" : "border-l-0 sm:border-l",
        className
      )}
    >
      <Tabs
        value={effectiveTab}
        onValueChange={(v) => {
          if (!activeTab) setLocalTab(v as "vocabulary" | "history" | "tutor")
        }}
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        {tabBar}
        <TabsContent value="vocabulary" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          {vocabToolbar}
          {vocabBody}
        </TabsContent>
        <TabsContent value="history" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          {historyBody}
        </TabsContent>
        <TabsContent value="tutor" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          <TutorChatPanel transcriptContext={tutorTranscriptContext} className={cn("min-h-0 flex-1", hideTabs && "pb-16")} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
