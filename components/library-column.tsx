"use client"

import { useState } from "react"
import { Conversation, ConversationGroup, VocabularyItem, TutorSession } from "@/lib/types"
import { VocabularyCard } from "@/components/vocabulary-card"
import { VocabularyDeck } from "@/components/vocabulary-deck"
import { ConversationHistory } from "@/components/conversation-history"
import { TutorChatPanel } from "@/components/tutor-chat-panel"
import { TutorHistoryPanel } from "@/components/tutor-history-panel"
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
  MoreHorizontal,
  LayoutList,
  GalleryHorizontal,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface LibraryColumnProps {
  className?: string
  variant?: "split" | "solo"
  onCollapseRight?: () => void
  leftCollapsed?: boolean
  onExpandLeft?: () => void
  /** Externally controlled active tab (for mobile bottom nav) */
  activeTab?: "vocabulary" | "tutor" | "tutor-history"
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
  onAddVocabularyFromTutor?: (payload: { word: string; type: VocabularyItem["type"]; definition?: string; example_sentence?: string; korean_translation?: string; context?: string }) => void
  onSaveTutorSession?: (messages: import("@/lib/types").TutorChatMessage[]) => void
  tutorSessions: TutorSession[]
  onDeleteTutorSession: (id: string) => void
  vocabSourceFilter: "all" | "session" | "tutor" | "manual"
  setVocabSourceFilter: (f: "all" | "session" | "tutor" | "manual") => void
  tutorVocabCount: number
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
  onAddVocabularyFromTutor,
  onSaveTutorSession,
  tutorSessions,
  onDeleteTutorSession,
  vocabSourceFilter,
  setVocabSourceFilter,
  tutorVocabCount,
}: LibraryColumnProps) {
  const [localTab, setLocalTab] = useState<"vocabulary" | "tutor" | "tutor-history">("tutor")
  const effectiveTab = activeTab ?? localTab
  const [vocabDisplayView, setVocabDisplayView] = useState<"list" | "deck">("list")

  const scopeLabel =
    vocabSourceFilter === "tutor"
      ? "Tutor words"
      : vocabSourceFilter === "manual"
        ? "Manually added"
        : selectedConversationId
          ? "This recording"
          : selectedGroupId === "__ungrouped__"
            ? "Inbox (ungrouped)"
            : selectedGroupId
              ? "This folder"
              : "All saved words"

  const showSourceFilterClear = vocabSourceFilter !== "all"
  const showConversationFilterClear = vocabSourceFilter === "all" && selectedConversationId

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
          value="tutor"
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm sm:gap-1.5 sm:px-3"
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Tutor</span>
        </TabsTrigger>
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
          value="tutor-history"
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm sm:gap-1.5 sm:px-3"
        >
          <History className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">History</span>
          {tutorSessions.length > 0 && (
            <Badge variant="secondary" className="h-4 min-w-4 rounded-full px-1 text-[9px] leading-none sm:text-[10px]">
              {tutorSessions.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
    </div>
  )

  const vocabToolbar = (
    <div className="border-border flex min-w-0 shrink-0 flex-col gap-2 border-b px-3 py-2.5 sm:px-4">
      {/* Row 1: Scope label + view toggle + actions */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{scopeLabel}</p>
          {(showSourceFilterClear || showConversationFilterClear) && (
            <button onClick={onShowAllVocabulary} className="shrink-0 text-[11px] text-primary hover:underline">
              전체 보기
            </button>
          )}
          {masteredCount > 0 && (
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
              {masteredCount}/{scopedVocabulary.length} mastered
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* List / Deck view toggle */}
          <div className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setVocabDisplayView("list")}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md transition-all",
                vocabDisplayView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="리스트 보기"
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setVocabDisplayView("deck")}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md transition-all",
                vocabDisplayView === "deck" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="카드 보기"
            >
              <GalleryHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onShowManualAdd}
          >
            <Plus className="h-3.5 w-3.5" />
            추가
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => void onTranslateScoped()}
                disabled={isBatchTranslating}
              >
                {isBatchTranslating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Globe className="mr-2 h-3.5 w-3.5" />}
                전체 번역
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onExportCsv}>
                <FileDown className="mr-2 h-3.5 w-3.5" />
                CSV 내보내기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void onExportPdf()} disabled={isExportingPdf}>
                {isExportingPdf ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-2 h-3.5 w-3.5" />}
                PDF 내보내기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Source + type filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {/* Source filter */}
        {scopedVocabulary.length > 0 || vocabSourceFilter !== "all" ? (
          <>
            {(
              [
                { key: "all" as const, label: "All" },
                { key: "session" as const, label: "Session" },
                { key: "tutor" as const, label: tutorVocabCount > 0 ? `Tutor ${tutorVocabCount}` : "Tutor" },
              ]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setVocabSourceFilter(key)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  vocabSourceFilter === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
            <div className="mx-0.5 h-3.5 w-px shrink-0 bg-border/60" />
          </>
        ) : null}

        {/* Type filter */}
        {(
          [
            { key: "all" as const, label: `All ${scopedVocabulary.length}` },
            { key: "word" as const, label: `Words ${wordCount}` },
            { key: "idiom" as const, label: `Idioms ${idiomCount}` },
            { key: "slang" as const, label: `Slang ${slangCount}` },
          ]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setVocabFilter(key)}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              vocabFilter === key
                ? "border-foreground/30 bg-foreground/10 text-foreground"
                : "border-transparent bg-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )

  const vocabBody = (
    <div className="min-h-0 flex-1 overflow-hidden">
      {isLoadingVocab ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredVocabulary.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <BookOpen className="h-8 w-8 opacity-20" />
          <p className="max-w-[22ch] text-sm leading-relaxed text-balance">
            {vocabSourceFilter === "tutor"
              ? "Tutor에서 저장한 단어가 없습니다."
              : "아직 저장된 단어가 없습니다."}
          </p>
        </div>
      ) : vocabDisplayView === "deck" ? (
        <VocabularyDeck
          items={filteredVocabulary}
          onDelete={onDeleteVocab}
          onToggleMastered={onToggleMastered}
          onTranslate={onTranslate}
          translatingId={translatingId}
          className="h-full"
        />
      ) : (
        <div className="h-full overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
          <div className="flex flex-col gap-2 p-2.5 pb-4 sm:p-3 sm:pb-4">
            {filteredVocabulary.map((item) => (
              <VocabularyCard
                key={item.id}
                item={item}
                onDelete={onDeleteVocab}
                onToggleMastered={onToggleMastered}
                onTranslate={onTranslate}
                isTranslating={translatingId === item.id}
                variant="list"
              />
            ))}
          </div>
        </div>
      )}
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
        "border-border flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        variant === "split" ? "border-l" : "border-l-0 sm:border-l",
        className
      )}
    >
      <Tabs
        value={effectiveTab}
        onValueChange={(v) => {
          if (!activeTab) setLocalTab(v as "vocabulary" | "tutor" | "tutor-history")
        }}
        className="flex h-full min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        {tabBar}
        <TabsContent value="vocabulary" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          {vocabToolbar}
          {vocabBody}
        </TabsContent>
        <TabsContent value="tutor" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          <TutorChatPanel
            transcriptContext={tutorTranscriptContext}
            className="min-h-0 flex-1"
            onAddVocabularyItem={onAddVocabularyFromTutor}
            onSaveSession={onSaveTutorSession}
          />
        </TabsContent>
        <TabsContent value="tutor-history" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          <TutorHistoryPanel
            sessions={tutorSessions}
            onDeleteSession={onDeleteTutorSession}
            className="min-h-0 flex-1"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
