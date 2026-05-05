"use client"

import { useState } from "react"
import { RecordingControls } from "@/components/recording-controls"
import { TranscriptPanel } from "@/components/transcript-panel"
import { ManualAddForm } from "@/components/manual-add-form"
import { VocabularyItem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { TranscriptionDebugInfo, TranscriptionStatus, AudioInputSource } from "@/hooks/use-transcription"
import {
  PanelLeftClose,
  Pencil,
  Check,
  MousePointerClick,
  Loader2,
  WandSparkles,
  Download,
  History,
  Languages,
  Globe,
  FileUp,
  ClipboardPaste,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"

export interface TranscriptionColumnProps {
  className?: string
  contentClassName?: string
  showCollapseButton?: boolean
  onCollapseLeft?: () => void
  compactToolbar?: boolean
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

export function TranscriptionColumn({
  className,
  contentClassName,
  showCollapseButton = true,
  onCollapseLeft,
  compactToolbar,
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
  const toolbarWrap = compactToolbar ? "flex-col items-stretch" : "flex-wrap items-center"
  const [moreToolsOpen, setMoreToolsOpen] = useState(false)

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden border-border p-0 sm:gap-3 sm:p-4", className)}>
      <div
        className={cn(
          "z-20 shrink-0 space-y-2 bg-background/95 px-3 py-2 backdrop-blur supports-backdrop-filter:bg-background/80 sm:sticky sm:top-0 sm:px-4 sm:py-1",
          contentClassName
        )}
      >
        <div className={cn("flex gap-2", toolbarWrap)}>
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
                  className="h-9 shrink-0 gap-1.5 text-xs sm:h-8"
                  onClick={onPickTranscriptFile}
                  title="Load a plain-text transcript from a file"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Load</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 gap-1.5 text-xs sm:h-8"
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
              className="h-9 w-9 shrink-0 sm:h-7 sm:w-7"
              onClick={onCollapseLeft}
              title="Collapse transcribe panel"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>
        {(isRecording || transcript) && (
          <div className={cn("space-y-2", compactToolbar && "max-h-[42vh] overflow-y-auto overscroll-y-contain pr-0.5")}>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 shrink-0 gap-1.5 text-xs sm:h-7"
                onClick={() => void onToggleEditTranscript()}
              >
                {isEditingTranscript ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                {isEditingTranscript ? "Done" : "Edit transcript"}
              </Button>
              {!isEditingTranscript && (
                <p className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
                  <MousePointerClick className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 leading-snug">Select text to add a word to your list</span>
                </p>
              )}
            </div>
            <Collapsible open={moreToolsOpen} onOpenChange={setMoreToolsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-9 w-full justify-between gap-2 text-xs font-medium sm:h-8"
                  aria-expanded={moreToolsOpen}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Languages className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">Translation, speakers & recording</span>
                  </span>
                  {moreToolsOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Separator className="my-2" />
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  {recordedAudioBlob && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0 justify-start gap-1.5 text-xs sm:h-7 sm:justify-center"
                        onClick={() => void onRefineTranscript()}
                        disabled={isRefining}
                      >
                        {isRefining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                        <span className="truncate">{isRefining ? "Refining…" : "Re-transcribe (HQ)"}</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 shrink-0 justify-start gap-1.5 text-xs sm:h-7" onClick={onDownloadRecording}>
                        <Download className="h-3.5 w-3.5" />
                        Download audio
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0 justify-start gap-1.5 text-xs sm:h-7 sm:justify-center"
                    onClick={() => void onAutoDiarize()}
                    disabled={isDiarizing}
                  >
                    {isDiarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                    <span className="truncate">{isDiarizing ? "Labeling…" : "Auto label speakers"}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-9 shrink-0 justify-start gap-1.5 text-xs sm:h-7 sm:justify-center"
                    onClick={() => void onTranslateRecent()}
                    disabled={isTranslatingRecent || !recentSnippet}
                  >
                    {isTranslatingRecent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                    Translate latest
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-9 shrink-0 justify-start gap-1.5 text-xs sm:h-7 sm:justify-center"
                    onClick={() => void onTranslateAllTranscript()}
                    disabled={isTranslatingAllText || !transcript.trim()}
                  >
                    {isTranslatingAllText ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                    Translate entire transcript
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 [-webkit-overflow-scrolling:touch] sm:px-0 sm:pb-2 sm:pt-0">
      {status === "loading_model" && loadingFile && (
        <div className="bg-muted shrink-0 rounded-lg px-3 py-2">
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
            <span className="truncate">{loadingFile}</span>
            <span className="shrink-0 tabular-nums">{loadingProgress}%</span>
          </div>
          <div className="bg-border h-1 w-full rounded-full">
            <div
              className="bg-primary h-1 rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {recentSnippet && (
        <div className="bg-primary/5 border-primary/20 shrink-0 rounded-xl border px-3 py-2.5">
          <p className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide uppercase">
            {isRecording ? "Live" : "Recent"}
          </p>
          <p className="text-foreground text-sm leading-relaxed">{recentSnippet}</p>
          {recentSnippetTranslation && (
            <p className="text-primary mt-1.5 text-sm font-medium leading-relaxed">{recentSnippetTranslation}</p>
          )}
        </div>
      )}
      {speakerPreview && (
        <div className="bg-muted/40 shrink-0 rounded-xl border border-border px-3 py-2.5">
          <p className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide uppercase">Speaker preview</p>
          <pre className="text-foreground text-xs whitespace-pre-wrap leading-relaxed">{speakerPreview}</pre>
        </div>
      )}
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
        <div className="bg-primary/5 border-primary/20 shrink-0 rounded-xl border px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Full transcript translation</p>
            <Button size="sm" variant="ghost" className="h-8 min-w-14 px-2 text-[11px] sm:h-6" onClick={onToggleFullTranslationExpanded}>
              {isFullTranscriptExpanded ? "Fold" : "Unfold"}
            </Button>
          </div>
          {isFullTranscriptExpanded && (
            <p className="text-primary text-sm font-medium whitespace-pre-wrap leading-relaxed">{fullTranscriptTranslation}</p>
          )}
        </div>
      )}
      {isRecording && (
        <p className="text-muted-foreground font-mono text-[10px] leading-tight sm:text-[11px]">
          dbg frames:{debugInfo.framesCaptured} chunks:{debugInfo.chunksSent} level:{debugInfo.audioLevel.toFixed(4)} worker:
          {debugInfo.workerState}
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
