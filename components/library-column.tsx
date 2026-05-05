"use client"

import { Conversation, ConversationGroup, VocabularyItem } from "@/lib/types"
import { VocabularyCard } from "@/components/vocabulary-card"
import { ConversationHistory } from "@/components/conversation-history"
import { TutorChatPanel } from "@/components/tutor-chat-panel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, History, Plus, Globe, FileDown, Loader2, EyeOff, PanelRightClose, PanelLeftOpen, ListFilter, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

export interface LibraryColumnProps {
  className?: string
  variant?: "split" | "solo"
  onCollapseRight?: () => void
  leftCollapsed?: boolean
  onExpandLeft?: () => void
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
  /** Latest transcript text (optional context for the tutor). */
  tutorTranscriptContext: string
}

export function LibraryColumn({
  className,
  variant = "split",
  onCollapseRight,
  leftCollapsed,
  onExpandLeft,
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
  const scopeLabel =
    selectedConversationId
      ? "This recording"
      : selectedGroupId === "__ungrouped__"
        ? "Inbox (ungrouped)"
        : selectedGroupId
          ? "This folder"
          : "All saved words"

  const tabBar = (
    <div className="border-border shrink-0 border-b px-3 pt-2 sm:px-4">
      <div className="mb-2 flex items-center justify-end gap-1">
        {onCollapseRight && (
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-6 sm:w-6" onClick={onCollapseRight} title="Collapse study panel">
            <PanelRightClose className="h-3.5 w-3.5" />
          </Button>
        )}
        {leftCollapsed && onExpandLeft && (
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-6 sm:w-6" onClick={onExpandLeft} title="Expand transcribe panel">
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <TabsList className="grid h-auto w-full grid-cols-3 gap-0.5 rounded-xl bg-muted/70 p-1 sm:gap-1">
        <TabsTrigger value="vocabulary" className="gap-0.5 rounded-lg px-1 py-2.5 text-[10px] sm:gap-1.5 sm:px-2 sm:py-1.5 sm:text-xs">
          <BookOpen className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
          <span className="truncate">Words</span>
          {scopedVocabulary.length > 0 && (
            <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] sm:h-4 sm:px-1.5 sm:text-[10px]">
              {scopedVocabulary.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-0.5 rounded-lg px-1 py-2.5 text-[10px] sm:gap-1.5 sm:px-2 sm:py-1.5 sm:text-xs">
          <History className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
          <span className="truncate">Sessions</span>
          {conversations.length > 0 && (
            <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] sm:h-4 sm:px-1.5 sm:text-[10px]">
              {conversations.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="tutor" className="gap-0.5 rounded-lg px-1 py-2.5 text-[10px] sm:gap-1.5 sm:px-2 sm:py-1.5 sm:text-xs">
          <MessageCircle className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
          <span className="truncate">Tutor</span>
        </TabsTrigger>
      </TabsList>
    </div>
  )

  const vocabToolbar = (
    <div className="border-border flex min-w-0 shrink-0 flex-col gap-3 border-b px-3 py-2.5 sm:px-4 sm:py-2">
      <div className="min-w-0 w-full space-y-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium leading-snug">{scopeLabel}</p>
          <p className="text-muted-foreground/80 mt-0.5 text-[10px] leading-snug">Words and phrases for the scope above.</p>
        </div>
        <div className="-mx-1 flex min-w-0 flex-wrap items-end gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:thin]">
          <div className="flex shrink-0 flex-col gap-0.5">
            <span className="text-muted-foreground flex items-center gap-1 pl-0.5 text-[10px] font-medium tracking-wide uppercase">
              <ListFilter className="h-3 w-3" />
              View
            </span>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-muted/50 p-0.5">
              <Button variant={vocabView === "items" ? "secondary" : "ghost"} size="sm" className="h-8 shrink-0 px-2.5 text-[11px] sm:h-6" onClick={() => setVocabView("items")}>
                Items
              </Button>
              <Button
                variant={vocabView === "frequency" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 shrink-0 px-2.5 text-[11px] sm:h-6"
                onClick={() => setVocabView("frequency")}
              >
                Top words
              </Button>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-0.5">
            <span className="text-muted-foreground pl-0.5 text-[10px] font-medium tracking-wide uppercase">Type</span>
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
              <Button variant={vocabFilter === "all" ? "secondary" : "ghost"} size="sm" className="h-8 shrink-0 px-2 text-[11px] sm:h-6" onClick={() => setVocabFilter("all")}>
                All {scopedVocabulary.length}
              </Button>
              <Button variant={vocabFilter === "word" ? "secondary" : "ghost"} size="sm" className="h-8 shrink-0 px-2 text-[11px] sm:h-6" onClick={() => setVocabFilter("word")}>
                Words {wordCount}
              </Button>
              <Button variant={vocabFilter === "idiom" ? "secondary" : "ghost"} size="sm" className="h-8 shrink-0 px-2 text-[11px] sm:h-6" onClick={() => setVocabFilter("idiom")}>
                Idioms {idiomCount}
              </Button>
              <Button variant={vocabFilter === "slang" ? "secondary" : "ghost"} size="sm" className="h-8 shrink-0 px-2 text-[11px] sm:h-6" onClick={() => setVocabFilter("slang")}>
                Slang {slangCount}
              </Button>
            </div>
          </div>
          {selectedConversationId && (
            <Button variant="ghost" size="sm" className="text-muted-foreground h-8 shrink-0 px-2 text-xs sm:h-5" onClick={onShowAllVocabulary}>
              Clear recording filter
            </Button>
          )}
        </div>
      </div>
      <Separator className="bg-border/80" />
      <div className="flex min-w-0 w-full flex-col gap-2">
        <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">Export & translate</span>
        <div className="flex min-w-0 w-full flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs sm:h-7" onClick={onExportCsv} title="Export vocabulary as CSV">
            <FileDown className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs sm:h-7" onClick={() => void onExportPdf()} disabled={isExportingPdf} title="Export vocabulary as PDF">
            {isExportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            PDF
          </Button>
          <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs sm:h-7" onClick={onShowManualAdd}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
          <Button variant="ghost" size="sm" className="h-9 min-w-0 gap-1 px-2 text-xs sm:h-7" onClick={() => void onTranslateScoped()} disabled={isBatchTranslating} title="Translate all in current scope">
            {isBatchTranslating ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Globe className="h-3.5 w-3.5 shrink-0" />}
            <span className="min-w-0 truncate">Translate all</span>
          </Button>
        </div>
      </div>
    </div>
  )

  const vocabBody = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
      <div className="flex flex-col gap-1.5 p-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-1 sm:pb-2">
        {isLoadingVocab ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : vocabView === "items" && filteredVocabulary.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12">
            <BookOpen className="h-10 w-10 opacity-25" />
            <p className="text-center text-xs text-balance leading-relaxed">No items in this filter yet.</p>
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
            {masteredCount > 0 && (
              <p className="text-muted-foreground py-2 text-center text-xs">
                {masteredCount} of {scopedVocabulary.length} mastered
              </p>
            )}
          </>
        ) : frequentWords.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12">
            <BookOpen className="h-10 w-10 opacity-25" />
            <p className="text-center text-xs text-balance leading-relaxed">No frequent words in this scope yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {frequentWords.map((item) => (
              <div
                key={item.word}
                className="border-border flex flex-col gap-2 rounded-lg border bg-card/50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 max-w-full text-sm font-medium break-all sm:break-normal sm:truncate">{item.word}</span>
                  <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">
                    {item.count}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="secondary" className="h-9 flex-1 text-xs sm:h-8 sm:flex-none" onClick={() => void onAddFrequentWord(item.word)}>
                    + Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground h-9 flex-1 text-xs sm:h-8 sm:flex-none"
                    onClick={() => onExcludeTopWord(item.word)}
                    title="Exclude from top words globally"
                  >
                    <EyeOff className="mr-1 h-3.5 w-3.5" />
                    Exclude
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
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
      <Tabs defaultValue="vocabulary" className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
        {tabBar}
        <TabsContent value="vocabulary" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          {vocabToolbar}
          {vocabBody}
        </TabsContent>
        <TabsContent value="history" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          {historyBody}
        </TabsContent>
        <TabsContent value="tutor" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          <TutorChatPanel transcriptContext={tutorTranscriptContext} className="min-h-0 flex-1" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
