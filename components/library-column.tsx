"use client"

import { useState } from "react"
import { Conversation, ConversationGroup, VocabularyItem, TutorSession } from "@/lib/types"
import { VocabularyCard } from "@/components/vocabulary-card"
import { VocabularyDeck } from "@/components/vocabulary-deck"
import { ConversationHistory } from "@/components/conversation-history"
import { TutorChatPanel } from "@/components/tutor-chat-panel"
import { StudyPanel } from "@/components/study-panel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BookOpen,
  GraduationCap,
  Plus,
  FileDown,
  Loader2,
  EyeOff,
  PanelRightClose,
  PanelLeftOpen,
  MessageCircle,
  LayoutList,
  GalleryHorizontal,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/locale-context"
import { AddVocabDialog, type AddVocabPayload } from "@/components/add-vocab-dialog"

export interface LibraryColumnProps {
  className?: string
  variant?: "split" | "solo"
  onCollapseRight?: () => void
  leftCollapsed?: boolean
  onExpandLeft?: () => void
  /** Externally controlled active tab (for mobile bottom nav) */
  activeTab?: "vocabulary" | "tutor" | "study"
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
  vocabFilter: "all" | "word" | "expression" | "rephrase"
  setVocabFilter: (f: "all" | "word" | "expression" | "rephrase") => void
  wordCount: number
  expressionCount: number
  rephraseCount: number
  filteredVocabulary: VocabularyItem[]
  allVocabulary: VocabularyItem[]
  frequentWords: { word: string; count: number }[]
  isLoadingVocab: boolean
  isExportingPdf: boolean
  masteredCount: number
  onShowAllVocabulary: () => void
  onExportPdf: () => void | Promise<void>
  onShowManualAdd: () => void
  onAddVocabItems?: (items: AddVocabPayload[]) => Promise<void>
  onDeleteVocab: (id: string) => void | Promise<void>
  onToggleMastered: (id: string, current: boolean) => void | Promise<void>
  onUpdateVocab?: (id: string, fields: Partial<Pick<VocabularyItem, "extra_examples" | "etymology" | "related_forms" | "view_count" | "user_sentences">>) => void | Promise<void>
  onTranslate: (item: VocabularyItem) => void | Promise<void>
  translatingId: string | null
  onAddFrequentWord: (word: string) => void | Promise<void>
  tutorTranscriptContext: string
  onAddVocabularyFromTutor?: (payload: { word: string; type: VocabularyItem["type"]; definition?: string; example_sentence?: string; korean_translation?: string; context?: string }) => void
  onSaveTutorSession?: (messages: import("@/lib/types").TutorChatMessage[]) => void
  tutorSessions: TutorSession[]
  onDeleteTutorSession: (id: string) => void
  vocabSourceFilter: "all" | "session" | "tutor" | "manual"
  setVocabSourceFilter: (f: "all" | "session" | "tutor" | "manual") => void
  tutorVocabCount: number
  onOrganizeVocabulary?: () => Promise<void>
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
  expressionCount,
  rephraseCount,
  filteredVocabulary,
  allVocabulary,
  frequentWords,
  isLoadingVocab,
  isExportingPdf,
  masteredCount,
  onShowAllVocabulary,
  onExportPdf,
  onShowManualAdd,
  onAddVocabItems,
  onDeleteVocab,
  onToggleMastered,
  onUpdateVocab,
  onTranslate,
  translatingId,
  onAddFrequentWord,
  tutorTranscriptContext,
  onAddVocabularyFromTutor,
  onSaveTutorSession,
  tutorSessions,
  onDeleteTutorSession,
  vocabSourceFilter,
  setVocabSourceFilter,
  tutorVocabCount,
  onOrganizeVocabulary,
}: LibraryColumnProps) {
  const [localTab, setLocalTab] = useState<"vocabulary" | "tutor" | "study">("tutor")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const { strings } = useLocale()
  const effectiveTab = activeTab ?? localTab
  const [vocabDisplayView, setVocabDisplayView] = useState<"list" | "deck">("deck")
  const [hideMastered, setHideMastered] = useState(true)
  const [isOrganizing, setIsOrganizing] = useState(false)
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null)

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
          value="study"
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm sm:gap-1.5 sm:px-3"
        >
          <GraduationCap className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Study</span>
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
      {/* Row 1: Scope label + mastered count */}
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{scopeLabel}</p>
        {(showSourceFilterClear || showConversationFilterClear) && (
          <button onClick={onShowAllVocabulary} className="shrink-0 text-[11px] text-primary hover:underline">
            전체 보기
          </button>
        )}
        {masteredCount > 0 && (
          <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground tabular-nums">
            {masteredCount}/{scopedVocabulary.length}
            <span className="hidden sm:inline"> mastered</span>
          </span>
        )}
      </div>

      {/* Row 2: Actions — scroll horizontally on narrow screens */}
      <div className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex shrink-0 items-center gap-1">
          {/* Hide mastered toggle */}
          {masteredCount > 0 && (
            <button
              type="button"
              onClick={() => setHideMastered((v) => !v)}
              title={hideMastered ? "학습 완료 포함해서 보기" : "학습 완료 숨기기"}
              className={cn(
                "flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-all",
                hideMastered
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <EyeOff className="h-3 w-3 shrink-0" />
              완료 {hideMastered ? "숨김" : `${masteredCount}`}
            </button>
          )}

          {/* List / Deck view toggle */}
          <div className="flex shrink-0 rounded-lg border border-border/60 bg-muted/40 p-0.5">
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

          {onOrganizeVocabulary && filteredVocabulary.length >= 3 && (
            <button
              type="button"
              disabled={isOrganizing}
              onClick={async () => {
                setIsOrganizing(true)
                setCollectionFilter(null)
                try { await onOrganizeVocabulary() } finally { setIsOrganizing(false) }
              }}
              className={cn(
                "flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-all",
                isOrganizing
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
              title="AI가 단어를 자동으로 단어장으로 정리해줘요"
            >
              {isOrganizing
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Sparkles className="h-3 w-3" />}
              {isOrganizing ? strings.words.organizing : strings.words.organize}
            </button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onAddVocabItems ? setShowAddDialog(true) : onShowManualAdd()}
          >
            <Plus className="h-3.5 w-3.5" />
            추가
          </Button>

          {/* PDF download — visible button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => void onExportPdf()}
            disabled={isExportingPdf || filteredVocabulary.length === 0}
            title={strings.words.pdfDownload}
          >
            {isExportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Row 3: Source + type filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {/* Source filter */}
        {scopedVocabulary.length > 0 || vocabSourceFilter !== "all" ? (
          <>
            {(
              [
                { key: "all" as const, label: strings.words.sourceAll },
                { key: "session" as const, label: strings.words.sourceSession },
                { key: "tutor" as const, label: tutorVocabCount > 0 ? `${strings.words.sourceTutor} ${tutorVocabCount}` : strings.words.sourceTutor },
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
            { key: "all" as const, label: `${strings.words.all} ${scopedVocabulary.length}` },
            { key: "word" as const, label: `${strings.words.words} ${wordCount}` },
            { key: "expression" as const, label: `${strings.words.expression} ${expressionCount}` },
            { key: "rephrase" as const, label: `${strings.words.rephrase} ${rephraseCount}` },
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

      {/* Row 4: Collection filter chips (only shown after AI organize) */}
      {(() => {
        const collections = [...new Set(filteredVocabulary.map((v) => v.collection).filter(Boolean))] as string[]
        if (collections.length === 0) return null
        return (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-1 [scrollbar-width:none]">
            <span className="shrink-0 text-[10px] text-muted-foreground/60">{strings.words.collection}</span>
            <button
              type="button"
              onClick={() => setCollectionFilter(null)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                collectionFilter === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {strings.words.collectionAll}
            </button>
            {collections.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setCollectionFilter(collectionFilter === col ? null : col)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  collectionFilter === col
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                {col}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCollectionFilter(null)}
              className="ml-auto shrink-0 flex items-center gap-0.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              title="컬렉션 필터 초기화"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })()}
    </div>
  )

  const displayedVocabulary = (() => {
    let list = hideMastered ? filteredVocabulary.filter((v) => !v.is_mastered) : filteredVocabulary
    if (collectionFilter) list = list.filter((v) => v.collection === collectionFilter)
    return list
  })()

  const vocabBody = (
    <div className="min-h-0 flex-1 overflow-hidden">
      {isLoadingVocab ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : displayedVocabulary.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <BookOpen className="h-8 w-8 opacity-20" />
          <p className="max-w-[22ch] text-sm leading-relaxed text-balance">
            {hideMastered && filteredVocabulary.length > 0
              ? strings.words.masteredOnly
              : vocabSourceFilter === "tutor"
                ? strings.words.emptyTutor
                : strings.words.empty}
          </p>
        </div>
      ) : vocabDisplayView === "deck" ? (
        <VocabularyDeck
          items={displayedVocabulary}
          onToggleMastered={onToggleMastered}
          onTranslate={onTranslate}
          onUpdateItem={onUpdateVocab}
          translatingId={translatingId}
          className="h-full"
        />
      ) : (
        <div className="h-full overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
          <div className="flex flex-col gap-2 px-4 py-3 pb-4 sm:px-8 md:px-12">
            {displayedVocabulary.map((item) => (
              <VocabularyCard
                key={item.id}
                item={item}
                onToggleMastered={onToggleMastered}
                onTranslate={onTranslate}
                onUpdateItem={onUpdateVocab}
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
          if (!activeTab) setLocalTab(v as "vocabulary" | "tutor" | "study")
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
        <TabsContent value="study" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          <StudyPanel
            vocabulary={filteredVocabulary}
            insightsVocabulary={allVocabulary}
            quizVocabulary={allVocabulary}
            sentencesVocabulary={allVocabulary}
            tutorSessions={tutorSessions}
            onAddRecommendedWord={onAddVocabItems ? (item) => onAddVocabItems([item]) : undefined}
            onUpdateVocab={onUpdateVocab}
            className="min-h-0 flex-1"
          />
        </TabsContent>
      </Tabs>

      {/* Add Vocab Dialog */}
      {onAddVocabItems && (
        <AddVocabDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onAddItems={onAddVocabItems}
        />
      )}
    </div>
  )
}
