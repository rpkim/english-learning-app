"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Square, Mic, Loader2, Save, Monitor, Plus } from "lucide-react"

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
  onNew,
  hasTranscript,
  isSaved = false,
}: RecordingControlsProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Timer */}
      {(isRecording || duration > 0) && (
        <div
          className={cn(
            "flex items-center gap-1.5 font-mono text-sm px-3 py-1.5 rounded-full border",
            isRecording
              ? "bg-recording/10 text-recording border-recording/30"
              : "bg-muted text-muted-foreground border-border"
          )}
        >
          {isRecording && (
            <span className="h-2 w-2 rounded-full bg-recording animate-pulse" />
          )}
          {formatDuration(duration)}
        </div>
      )}

      {/* Audio source badge — shown while recording */}
      {isRecording && audioSource && (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 text-xs border",
            audioSource === "system"
              ? "text-primary border-primary/30 bg-primary/5"
              : "text-accent-foreground border-accent/40 bg-accent/10"
          )}
        >
          {audioSource === "system" ? (
            <Monitor className="h-3 w-3" />
          ) : (
            <Mic className="h-3 w-3" />
          )}
          {audioSource === "system" ? "System audio" : "Microphone"}
        </Badge>
      )}

      {/* Start / Stop button */}
      {isRecording ? (
        <Button
          onClick={onStop}
          variant="destructive"
          className="gap-2 font-semibold"
          disabled={isLoading}
        >
          <Square className="h-4 w-4 fill-current" />
          Stop
        </Button>
      ) : (
        <Button
          onClick={onStart}
          className="gap-2 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {isLoading ? "Starting..." : "Start"}
        </Button>
      )}

      {/* Save button */}
      {hasTranscript && !isRecording && (
        <>
          <Button onClick={onNew} variant="ghost" className="gap-1.5" disabled={isSaving || isExtracting || isLoading}>
            <Plus className="h-4 w-4" />
            New
          </Button>
          <Button
            onClick={onSave}
            variant="outline"
            className="gap-2"
            disabled={isSaving || isExtracting}
          >
            {isSaving || isExtracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isExtracting ? "Extracting..." : isSaving ? "Saving..." : isSaved ? "Saved" : "Save & Extract"}
          </Button>
        </>
      )}
    </div>
  )
}
