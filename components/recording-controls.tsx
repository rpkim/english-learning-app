"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Square, Mic, Loader2, Save, Monitor, Plus, RefreshCw, Sparkles } from "lucide-react"

interface RecordingControlsProps {
  isRecording: boolean
  isLoading: boolean
  isSaving: boolean
  isExtracting: boolean
  duration: number
  audioSource?: "system" | "microphone" | null
  onStart: () => void
  onStop: () => void
  onSave: () => void
  onExtractOnly?: () => void
  onNew: () => void
  hasTranscript: boolean
  isSaved?: boolean
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0")
  const s = (seconds % 60).toString().padStart(2, "0")
  return `${m}:${s}`
}

export function RecordingControls({
  isRecording,
  isLoading,
  isSaving,
  isExtracting,
  duration,
  audioSource,
  onStart,
  onStop,
  onSave,
  onExtractOnly,
  onNew,
  hasTranscript,
  isSaved = false,
}: RecordingControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Timer pill */}
      {(isRecording || duration > 0) && (
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm font-medium tabular-nums",
            isRecording
              ? "border-recording/40 bg-recording/10 text-recording"
              : "border-border bg-muted text-muted-foreground"
          )}
        >
          {isRecording && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-recording animate-pulse" />
          )}
          {formatDuration(duration)}
        </div>
      )}

      {/* Audio source badge while recording */}
      {isRecording && audioSource && (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 text-xs",
            audioSource === "system"
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-accent/40 bg-accent/10 text-accent-foreground"
          )}
        >
          {audioSource === "system" ? (
            <Monitor className="h-3 w-3" />
          ) : (
            <Mic className="h-3 w-3" />
          )}
          {audioSource === "system" ? "System" : "Mic"}
        </Badge>
      )}

      {/* Start / Stop */}
      {isRecording ? (
        <Button
          onClick={onStop}
          variant="destructive"
          size="sm"
          className="h-9 gap-2 font-semibold shadow-sm"
          disabled={isLoading}
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          Stop
        </Button>
      ) : (
        <Button
          onClick={onStart}
          size="sm"
          className="h-9 gap-2 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          {isLoading ? "Starting…" : "Start"}
        </Button>
      )}

      {/* Post-recording actions */}
      {hasTranscript && !isRecording && (
        <>
          <Button
            onClick={onNew}
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
            disabled={isSaving || isExtracting || isLoading}
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>

          {!isSaved && onExtractOnly && (
            <Button
              onClick={onExtractOnly}
              variant="secondary"
              size="sm"
              className="h-9 gap-1.5 px-2.5"
              disabled={isSaving || isExtracting}
              title="Extract vocabulary without creating a new session"
            >
              {isExtracting && !isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {isExtracting && !isSaving ? "Extracting…" : "Extract words"}
              </span>
              <span className="sm:hidden">{isExtracting && !isSaving ? "…" : "Extract"}</span>
            </Button>
          )}

          <Button
            onClick={onSave}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 px-2.5"
            disabled={isSaving || isExtracting}
          >
            {isSaving || isExtracting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isSaved ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {isExtracting
              ? "Extracting…"
              : isSaving
                ? "Saving…"
                : isSaved
                  ? "Extract again"
                  : "Save & Extract"}
          </Button>
        </>
      )}
    </div>
  )
}
