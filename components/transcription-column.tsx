"use client"

import { useState } from "react"
import { RecordingControls } from "@/components/recording-controls"
import { TranscriptPanel } from "@/components/transcript-panel"
import { ManualAddForm } from "@/components/manual-add-form"
import { VocabularyItem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TranscriptionDebugInfo, TranscriptionStatus, AudioInputSource } from "@/hooks/use-transcription"
import {
  PanelLeftClose,
  Pencil,
  Check,
  Loader2,
  WandSparkles,
  Download,
  History,
  Languages,
  Globe,
  FileUp,
  ClipboardPaste,
  ChevronDown,
  ChevronUp,
  Square,
  Mic,
  Monitor,
  Plus,
  Sparkles,
  RefreshCw,
  MoreHorizontal,
  Save,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function RefineProgressBanner({ progress }: { progress: number }) {
  return (
    <div className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3.5 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <WandSparkles className="h-3.5 w-3.5 animate-pulse text-amber-500" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Re-transcribing with HQ model…</span>
        </div>
        <span className="shrink-0 tabular-nums text-xs font-semibold text-amber-700 dark:text-amber-400">
          {progress}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-500/20">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export interface TranscriptionColumnProps {
  className?: string
  contentClassName?: string
  showCollapseButton?: boolean
  onCollapseLeft?: () => void
  compactToolbar?: boolean
  hasBottomNav?: boolean
  isRecording: boolean
  status: TranscriptionStatus
  isSaving: boolean
  isExtracting: boolean
  duration: number
  audioSource: AudioInputSource | null
  onStart: () => void
  onStop: () => void
  onSave: () => void | Promise<void>
  onExtractOnly: () => void | Promise<void>
  onPickTranscriptFile: () => void
  onPasteTranscript: () => void
  onNew: () => void
  hasTranscript: boolean
  isCurrentTranscriptSaved: boolean
  transcript: string
  interimTranscript: string
  vocabulary: VocabularyItem[]
  onTranscriptChange: (value: string) => void
  onTextSelect: (text: string) => void
  isEditingTranscript: boolean
  onToggleEditTranscript: () => void | Promise<void>
  recordedAudioBlob: Blob | null
  onRefineTranscript: () => void | Promise<void>
  isRefining: boolean
  refineProgress?: number
  onDownloadRecording: () => void
  onAutoDiarize: () => void | Promise<void>
  isDiarizing: boolean
  onTranslateRecent: () => void | Promise<void>
  isTranslatingRecent: boolean
  recentSnippet: string
  onTranslateAllTranscript: () => void | Promise<void>
  isTranslatingAllText: boolean
  recentSnippetTranslation: string
  speakerPreview: string
  onApplySpeakerLabels?: () => void
  loadingFile: string
  loadingProgress: number
  fullTranscriptTranslation: string
  isFullTranscriptExpanded: boolean
  onToggleFullTranslationExpanded: () => void
  debugInfo: TranscriptionDebugInfo
  showManualAdd: boolean
  manualWord: string
  onManualAdd: (item: { word: string; type: string; definition: string; context: string }) => Promise<void>
  onTranslateSelectedText: (text: string) => Promise<void>
  translatedSelectedText: string | null
  isTranslatingSelectedText: boolean
  onCancelManualAdd: () => void
  isSubmittingManual: boolean
}

function fmt(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

// ─────────────────────────────────────────────
//  Mobile — State 1: Empty (not recording, no transcript)
// ─────────────────────────────────────────────
function MobileEmptyState({
  status,
  loadingFile,
  loadingProgress,
  onStart,
  onPickTranscriptFile,
  onPasteTranscript,
}: Pick<TranscriptionColumnProps, "status" | "loadingFile" | "loadingProgress" | "onStart" | "onPickTranscriptFile" | "onPasteTranscript">) {
  const isLoading = status === "loading_model"

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-8 px-6 pb-4">
      {/* Model loading progress */}
      {isLoading && loadingFile && (
        <div className="w-full max-w-xs rounded-2xl border border-border bg-card px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{loadingFile}</span>
            <span className="tabular-nums font-medium text-foreground">{loadingProgress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Hero icon + text */}
      <div className="flex flex-col items-center gap-5 text-center">
        <div className={cn(
          "rounded-3xl p-7 transition-colors",
          isLoading ? "bg-muted/60" : "bg-primary/10"
        )}>
          {isLoading ? (
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          ) : (
            <Mic className="h-12 w-12 text-primary" />
          )}
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            {isLoading ? "Loading speech model…" : "Ready to capture"}
          </p>
          <p className="mt-1.5 max-w-[26ch] text-sm leading-relaxed text-muted-foreground text-balance">
            {isLoading
              ? "Downloading the model once. Won't need the internet next time."
              : "Tap Start to transcribe English audio live from your mic or system."}
          </p>
        </div>
      </div>

      {/* Primary CTA */}
      {!isLoading && (
        <Button
          onClick={onStart}
          size="lg"
          className="h-14 w-full max-w-[280px] gap-3 rounded-2xl text-base font-bold shadow-md shadow-primary/20"
        >
          <Mic className="h-5 w-5" />
          Start Recording
        </Button>
      )}

      {/* Secondary actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-xl text-xs"
          onClick={onPickTranscriptFile}
        >
          <FileUp className="h-3.5 w-3.5" />
          Load file
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-xl text-xs"
          onClick={onPasteTranscript}
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Paste text
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Mobile — State 2: Recording
// ─────────────────────────────────────────────
function MobileRecordingState({
  duration,
  audioSource,
  onStop,
  transcript,
  interimTranscript,
  vocabulary,
  onTranscriptChange,
  onTextSelect,
  debugInfo,
}: Pick<
  TranscriptionColumnProps,
  | "duration"
  | "audioSource"
  | "onStop"
  | "transcript"
  | "interimTranscript"
  | "vocabulary"
  | "onTranscriptChange"
  | "onTextSelect"
  | "debugInfo"
>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Recording bar */}
      <div className="shrink-0 flex items-center justify-between gap-3 border-b border-recording/20 bg-recording/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-recording" />
          <span className="font-mono text-base font-bold tabular-nums text-recording">
            {fmt(duration)}
          </span>
          {audioSource && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1 text-xs",
                audioSource === "system"
                  ? "border-recording/30 bg-transparent text-recording/80"
                  : "border-recording/30 bg-transparent text-recording/80"
              )}
            >
              {audioSource === "system" ? (
                <Monitor className="h-3 w-3" />
              ) : (
                <Mic className="h-3 w-3" />
              )}
              {audioSource === "system" ? "System" : "Microphone"}
            </Badge>
          )}
        </div>
        <Button
          onClick={onStop}
          variant="destructive"
          size="sm"
          className="h-9 gap-1.5 rounded-xl font-semibold"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          Stop
        </Button>
      </div>

      {/* Live transcript */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-2 pb-20 overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <TranscriptPanel
          transcript={transcript}
          interimTranscript={interimTranscript}
          isRecording={true}
          isEditing={false}
          vocabulary={vocabulary}
          onTranscriptChange={onTranscriptChange}
          onTextSelect={onTextSelect}
        />
        <p className="mt-2 font-mono text-[10px] leading-tight text-muted-foreground/50">
          dbg lvl:{debugInfo.audioLevel.toFixed(3)} chunks:{debugInfo.chunksSent} worker:{debugInfo.workerState}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Mobile — State 3: Has transcript, not recording
// ─────────────────────────────────────────────
function MobileTranscriptState({
  isSaving,
  isExtracting,
  isCurrentTranscriptSaved,
  isEditingTranscript,
  onSave,
  onExtractOnly,
  onNew,
  onStart,
  onToggleEditTranscript,
  onPickTranscriptFile,
  onPasteTranscript,
  transcript,
  interimTranscript,
  vocabulary,
  onTranscriptChange,
  onTextSelect,
  recentSnippet,
  recentSnippetTranslation,
  speakerPreview,
  onApplySpeakerLabels,
  fullTranscriptTranslation,
  isFullTranscriptExpanded,
  onToggleFullTranslationExpanded,
  onTranslateRecent,
  isTranslatingRecent,
  onTranslateAllTranscript,
  isTranslatingAllText,
  onAutoDiarize,
  isDiarizing,
  recordedAudioBlob,
  onRefineTranscript,
  isRefining,
  refineProgress = 0,
  onDownloadRecording,
  showManualAdd,
  manualWord,
  onManualAdd,
  onTranslateSelectedText,
  translatedSelectedText,
  isTranslatingSelectedText,
  onCancelManualAdd,
  isSubmittingManual,
}: Omit<
  TranscriptionColumnProps,
  | "className"
  | "contentClassName"
  | "showCollapseButton"
  | "onCollapseLeft"
  | "compactToolbar"
  | "hasBottomNav"
  | "isRecording"
  | "status"
  | "duration"
  | "audioSource"
  | "onStop"
  | "hasTranscript"
  | "loadingFile"
  | "loadingProgress"
  | "debugInfo"
>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Compact secondary toolbar */}
      <div className="shrink-0 flex items-center gap-1 border-b border-border/60 px-3 py-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={onNew}
        >
          <Plus className="h-3.5 w-3.5" />
          Clear
        </Button>
        <Button
          size="sm"
          variant={isEditingTranscript ? "default" : "ghost"}
          className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
          onClick={() => void onToggleEditTranscript()}
        >
          {isEditingTranscript ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          {isEditingTranscript ? "Done" : "Edit"}
        </Button>
        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem className="gap-2 text-xs" onClick={() => void onTranslateRecent()} disabled={isTranslatingRecent || !recentSnippet}>
              {isTranslatingRecent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
              Translate latest
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs" onClick={() => void onTranslateAllTranscript()} disabled={isTranslatingAllText}>
              {isTranslatingAllText ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
              Translate full transcript
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs" onClick={() => void onAutoDiarize()} disabled={isDiarizing}>
              {isDiarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
              Label speakers (A/B)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-xs" onClick={onPickTranscriptFile}>
              <FileUp className="h-3.5 w-3.5" />
              Load from file
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs" onClick={onPasteTranscript}>
              <ClipboardPaste className="h-3.5 w-3.5" />
              Paste text
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-xs"
              onClick={() => void onRefineTranscript()}
              disabled={isRefining || !recordedAudioBlob}
            >
              {isRefining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
              Re-transcribe (HQ)
              {!recordedAudioBlob && <span className="ml-auto text-[10px] text-muted-foreground">record first</span>}
            </DropdownMenuItem>
            {recordedAudioBlob && (
              <DropdownMenuItem className="gap-2 text-xs" onClick={onDownloadRecording}>
                <Save className="h-3.5 w-3.5" />
                Download audio
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Re-record shortcut */}
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
            onClick={onStart}
          >
            <Mic className="h-3.5 w-3.5" />
            Record
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-3 pt-2 pb-20 [-webkit-overflow-scrolling:touch]">
        {/* Recent snippet with translation */}
        {recentSnippet && (
          <div className="mb-3 shrink-0 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary/60">Recent</p>
            <p className="text-sm leading-relaxed text-foreground">{recentSnippet}</p>
            {recentSnippetTranslation && (
              <p className="mt-2 text-sm font-medium leading-relaxed text-primary">{recentSnippetTranslation}</p>
            )}
          </div>
        )}

        {speakerPreview && (
          <div className="mb-3 shrink-0 rounded-xl border border-border bg-muted/30 px-3.5 py-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Speaker preview</p>
              {onApplySpeakerLabels && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={onApplySpeakerLabels}
                >
                  <Check className="h-3 w-3" />
                  Apply
                </Button>
              )}
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-relaxed">{speakerPreview}</pre>
          </div>
        )}

        {isRefining && <div className="mb-3"><RefineProgressBanner progress={refineProgress} /></div>}

        <TranscriptPanel
          transcript={transcript}
          interimTranscript={interimTranscript}
          isRecording={false}
          isEditing={isEditingTranscript}
          vocabulary={vocabulary}
          onTranscriptChange={onTranscriptChange}
          onTextSelect={onTextSelect}
        />

        {fullTranscriptTranslation && (
          <div className="mt-3 shrink-0 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">Full translation</p>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={onToggleFullTranslationExpanded}>
                {isFullTranscriptExpanded ? "Collapse" : "Expand"}
              </Button>
            </div>
            {isFullTranscriptExpanded && (
              <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-primary">{fullTranscriptTranslation}</p>
            )}
          </div>
        )}

        {showManualAdd && (
          <div className="mt-3 shrink-0">
            <ManualAddForm
              initialWord={manualWord}
              onAdd={onManualAdd}
              onTranslateSelected={onTranslateSelectedText}
              translatedSelectedText={translatedSelectedText}
              isTranslatingSelected={isTranslatingSelectedText}
              onCancel={onCancelManualAdd}
              isSubmitting={isSubmittingManual}
            />
          </div>
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div className="shrink-0 border-t border-border bg-background/95 px-3 py-2.5 backdrop-blur-sm">
        {!isCurrentTranscriptSaved ? (
          <Button
            onClick={() => void onSave()}
            className="h-11 w-full gap-2 rounded-xl font-semibold"
            disabled={isSaving || isExtracting}
          >
            {isSaving || isExtracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isExtracting ? "Extracting vocabulary…" : isSaving ? "Saving…" : "Save & Extract Vocabulary"}
          </Button>
        ) : (
          <Button
            onClick={() => void onSave()}
            variant="outline"
            className="h-11 w-full gap-2 rounded-xl"
            disabled={isSaving || isExtracting}
          >
            {isSaving || isExtracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isExtracting ? "Extracting…" : "Extract vocabulary again"}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────
export function TranscriptionColumn({
  className,
  contentClassName,
  showCollapseButton = true,
  onCollapseLeft,
  compactToolbar,
  hasBottomNav = false,
  isRecording,
  status,
  isSaving,
  isExtracting,
  duration,
  audioSource,
  onStart,
  onStop,
  onSave,
  onExtractOnly,
  onPickTranscriptFile,
  onPasteTranscript,
  onNew,
  hasTranscript,
  isCurrentTranscriptSaved,
  transcript,
  interimTranscript,
  vocabulary,
  onTranscriptChange,
  onTextSelect,
  isEditingTranscript,
  onToggleEditTranscript,
  recordedAudioBlob,
  onRefineTranscript,
  isRefining,
  refineProgress = 0,
  onDownloadRecording,
  onAutoDiarize,
  isDiarizing,
  onTranslateRecent,
  isTranslatingRecent,
  recentSnippet,
  onTranslateAllTranscript,
  isTranslatingAllText,
  recentSnippetTranslation,
  speakerPreview,
  onApplySpeakerLabels,
  loadingFile,
  loadingProgress,
  fullTranscriptTranslation,
  isFullTranscriptExpanded,
  onToggleFullTranslationExpanded,
  debugInfo,
  showManualAdd,
  manualWord,
  onManualAdd,
  onTranslateSelectedText,
  translatedSelectedText,
  isTranslatingSelectedText,
  onCancelManualAdd,
  isSubmittingManual,
}: TranscriptionColumnProps) {
  const [moreToolsOpen, setMoreToolsOpen] = useState(false)

  // ── Mobile render paths ──────────────────────────────
  if (hasBottomNav) {
    const outer = cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)

    if (isRecording) {
      return (
        <div className={outer}>
          <MobileRecordingState
            duration={duration}
            audioSource={audioSource}
            onStop={onStop}
            transcript={transcript}
            interimTranscript={interimTranscript}
            vocabulary={vocabulary}
            onTranscriptChange={onTranscriptChange}
            onTextSelect={onTextSelect}
            debugInfo={debugInfo}
          />
        </div>
      )
    }

    if (!hasTranscript) {
      return (
        <div className={outer}>
          <MobileEmptyState
            status={status}
            loadingFile={loadingFile}
            loadingProgress={loadingProgress}
            onStart={onStart}
            onPickTranscriptFile={onPickTranscriptFile}
            onPasteTranscript={onPasteTranscript}
          />
        </div>
      )
    }

    return (
      <div className={outer}>
        <MobileTranscriptState
          isSaving={isSaving}
          isExtracting={isExtracting}
          isCurrentTranscriptSaved={isCurrentTranscriptSaved}
          isEditingTranscript={isEditingTranscript}
          onSave={onSave}
          onExtractOnly={onExtractOnly}
          onNew={onNew}
          onStart={onStart}
          onToggleEditTranscript={onToggleEditTranscript}
          onPickTranscriptFile={onPickTranscriptFile}
          onPasteTranscript={onPasteTranscript}
          transcript={transcript}
          interimTranscript={interimTranscript}
          vocabulary={vocabulary}
          onTranscriptChange={onTranscriptChange}
          onTextSelect={onTextSelect}
          recentSnippet={recentSnippet}
          recentSnippetTranslation={recentSnippetTranslation}
          speakerPreview={speakerPreview}
          onApplySpeakerLabels={onApplySpeakerLabels}
          fullTranscriptTranslation={fullTranscriptTranslation}
          isFullTranscriptExpanded={isFullTranscriptExpanded}
          onToggleFullTranslationExpanded={onToggleFullTranslationExpanded}
          onTranslateRecent={onTranslateRecent}
          isTranslatingRecent={isTranslatingRecent}
          onTranslateAllTranscript={onTranslateAllTranscript}
          isTranslatingAllText={isTranslatingAllText}
          onAutoDiarize={onAutoDiarize}
          isDiarizing={isDiarizing}
          recordedAudioBlob={recordedAudioBlob}
          onRefineTranscript={onRefineTranscript}
          isRefining={isRefining}
          refineProgress={refineProgress}
          onDownloadRecording={onDownloadRecording}
          showManualAdd={showManualAdd}
          manualWord={manualWord}
          onManualAdd={onManualAdd}
          onTranslateSelectedText={onTranslateSelectedText}
          translatedSelectedText={translatedSelectedText}
          isTranslatingSelectedText={isTranslatingSelectedText}
          onCancelManualAdd={onCancelManualAdd}
          isSubmittingManual={isSubmittingManual}
        />
      </div>
    )
  }

  // ── Desktop render ──────────────────────────────────
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden p-0", className)}>
      {/* Primary toolbar */}
      <div
        className={cn(
          "shrink-0 space-y-2 bg-background/95 px-3 py-2.5 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-4 sm:py-3",
          contentClassName
        )}
      >
        {/* Row 1: Recording controls + collapse */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <RecordingControls
              isRecording={isRecording}
              isLoading={status === "loading_model" && !isRecording}
              isSaving={isSaving}
              isExtracting={isExtracting}
              duration={duration}
              audioSource={audioSource}
              onStart={onStart}
              onStop={onStop}
              onSave={onSave}
              onExtractOnly={onExtractOnly}
              onNew={onNew}
              hasTranscript={hasTranscript}
              isSaved={isCurrentTranscriptSaved}
            />
            {!isRecording && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={onPickTranscriptFile}
                  title="Load a plain-text transcript from a file"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Load file</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={onPasteTranscript}
                  title="Paste transcript text"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Paste</span>
                </Button>
              </>
            )}
          </div>
          {showCollapseButton && onCollapseLeft && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={onCollapseLeft}
              title="Collapse transcribe panel"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Row 2: Secondary actions */}
        {(isRecording || transcript) && (
          <div className="space-y-2">
            <Separator className="bg-border/60" />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={isEditingTranscript ? "default" : "ghost"}
                className={cn(
                  "h-8 shrink-0 gap-1.5 text-xs",
                  !isEditingTranscript && "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => void onToggleEditTranscript()}
              >
                {isEditingTranscript ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                {isEditingTranscript ? "Done editing" : "Edit"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setMoreToolsOpen((p) => !p)}
                aria-expanded={moreToolsOpen}
              >
                <Languages className="h-3.5 w-3.5" />
                <span>Translate & more</span>
                {moreToolsOpen ? (
                  <ChevronUp className="h-3 w-3 opacity-60" />
                ) : (
                  <ChevronDown className="h-3 w-3 opacity-60" />
                )}
              </Button>
            </div>

            {moreToolsOpen && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 shrink-0 justify-start gap-1.5 text-xs sm:justify-center"
                    onClick={() => void onTranslateRecent()}
                    disabled={isTranslatingRecent || !recentSnippet}
                  >
                    {isTranslatingRecent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                    Translate latest
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 shrink-0 justify-start gap-1.5 text-xs sm:justify-center"
                    onClick={() => void onTranslateAllTranscript()}
                    disabled={isTranslatingAllText || !transcript.trim()}
                  >
                    {isTranslatingAllText ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                    Translate all
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 justify-start gap-1.5 text-xs sm:justify-center"
                    onClick={() => void onAutoDiarize()}
                    disabled={isDiarizing}
                  >
                    {isDiarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                    {isDiarizing ? "Labeling…" : "Label speakers"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 justify-start gap-1.5 text-xs sm:justify-center"
                    onClick={() => void onRefineTranscript()}
                    disabled={isRefining || !recordedAudioBlob}
                    title={!recordedAudioBlob ? "Only available after recording in this session" : undefined}
                  >
                    {isRefining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                    {isRefining ? "Refining…" : "Re-transcribe (HQ)"}
                  </Button>
                  {recordedAudioBlob && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 shrink-0 justify-start gap-1.5 text-xs text-muted-foreground"
                      onClick={onDownloadRecording}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download audio
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scrollable content area */}
      <div className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pt-2 [-webkit-overflow-scrolling:touch] sm:px-4 sm:pb-3",
        hasBottomNav ? "pb-20" : "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      )}>
        {status === "loading_model" && loadingFile && (
          <div className="shrink-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{loadingFile}</span>
              <span className="shrink-0 tabular-nums font-medium text-foreground">{loadingProgress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
            </div>
          </div>
        )}

        {recentSnippet && (
          <div className="shrink-0 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3">
            <p className="mb-1.5 text-[10px] font-semibold tracking-widest text-primary/60 uppercase">
              {isRecording ? "Live" : "Recent"}
            </p>
            <p className="text-sm leading-relaxed text-foreground">{recentSnippet}</p>
            {recentSnippetTranslation && (
              <p className="mt-2 text-sm font-medium leading-relaxed text-primary">{recentSnippetTranslation}</p>
            )}
          </div>
        )}

        {speakerPreview && (
          <div className="shrink-0 rounded-xl border border-border bg-muted/30 px-3.5 py-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Speaker preview</p>
              {onApplySpeakerLabels && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={onApplySpeakerLabels}
                >
                  <Check className="h-3 w-3" />
                  Apply to transcript
                </Button>
              )}
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{speakerPreview}</pre>
          </div>
        )}

        {isRefining && <RefineProgressBanner progress={refineProgress} />}

        <TranscriptPanel
          transcript={transcript}
          interimTranscript={interimTranscript}
          isRecording={isRecording}
          isEditing={isEditingTranscript && !isRecording}
          vocabulary={vocabulary}
          onTranscriptChange={onTranscriptChange}
          onTextSelect={onTextSelect}
        />

        {fullTranscriptTranslation && (
          <div className="shrink-0 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold tracking-widest text-primary/60 uppercase">Full translation</p>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground" onClick={onToggleFullTranslationExpanded}>
                {isFullTranscriptExpanded ? "Collapse" : "Expand"}
              </Button>
            </div>
            {isFullTranscriptExpanded && (
              <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-primary">{fullTranscriptTranslation}</p>
            )}
          </div>
        )}

        {isRecording && (
          <p className="font-mono text-[10px] leading-tight text-muted-foreground/60">
            frames:{debugInfo.framesCaptured} chunks:{debugInfo.chunksSent} level:{debugInfo.audioLevel.toFixed(4)} worker:{debugInfo.workerState}
            {debugInfo.lastWorkerError ? ` err:${debugInfo.lastWorkerError}` : ""}
          </p>
        )}

        {showManualAdd && (
          <div className="shrink-0">
            <ManualAddForm
              initialWord={manualWord}
              onAdd={onManualAdd}
              onTranslateSelected={onTranslateSelectedText}
              translatedSelectedText={translatedSelectedText}
              isTranslatingSelected={isTranslatingSelectedText}
              onCancel={onCancelManualAdd}
              isSubmitting={isSubmittingManual}
            />
          </div>
        )}
      </div>
    </div>
  )
}
