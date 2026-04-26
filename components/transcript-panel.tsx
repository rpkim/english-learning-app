"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Mic2 } from "lucide-react"

interface TranscriptPanelProps {
  transcript: string
  interimTranscript: string
  isRecording: boolean
  onTextSelect: (text: string) => void
}

export function TranscriptPanel({
  transcript,
  interimTranscript,
  isRecording,
  onTextSelect,
}: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript, interimTranscript])

  const handleMouseUp = () => {
    const selection = window.getSelection()
    const selected = selection?.toString().trim()
    if (selected && selected.length > 1) {
      onTextSelect(selected)
    }
  }

  const isEmpty = !transcript && !interimTranscript

  return (
    <div
      className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 font-mono text-sm leading-relaxed select-text cursor-text relative min-h-0"
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
          <Mic2 className="h-10 w-10 opacity-30" />
          <p className="text-sm text-center text-balance">
            {isRecording
              ? "Listening... speak or play audio from your computer"
              : "Press Start to begin transcribing your computer audio"}
          </p>
        </div>
      ) : (
        <>
          <span className="text-foreground whitespace-pre-wrap">{transcript}</span>
          {interimTranscript && (
            <span className={cn("text-muted-foreground", isRecording && "animate-pulse")}>
              {interimTranscript}
            </span>
          )}
          <div ref={bottomRef} />
        </>
      )}
    </div>
  )
}
