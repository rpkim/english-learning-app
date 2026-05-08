"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Mic2 } from "lucide-react"
import { VocabularyItem } from "@/lib/types"

interface TranscriptPanelProps {
  transcript: string
  interimTranscript: string
  isRecording: boolean
  isEditing: boolean
  vocabulary: VocabularyItem[]
  onTranscriptChange: (value: string) => void
  onTextSelect: (text: string) => void
  onTranslateUtterance?: (text: string) => void | Promise<void>
  diarizedItems?: Array<{ text: string; speaker: "A" | "B" }>
}

export function TranscriptPanel({
  transcript,
  interimTranscript,
  isRecording,
  isEditing,
  vocabulary,
  onTranscriptChange,
  onTextSelect,
  onTranslateUtterance: _onTranslateUtterance,
  diarizedItems: _diarizedItems = [],
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
      className={cn(
        "relative min-h-[min(40dvh,14rem)] w-full min-w-0 shrink-0 cursor-text select-text rounded-xl border p-3 font-mono text-sm leading-relaxed transition-colors duration-300 sm:min-h-[min(48dvh,18rem)] sm:p-4",
        isRecording
          ? "border-recording/40 bg-recording/2.5"
          : "border-border bg-card"
      )}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      {isEmpty ? (
        <div className="text-muted-foreground flex min-h-[min(32dvh,12rem)] flex-col items-center justify-center gap-3 px-4 sm:min-h-48">
          <div className={cn(
            "rounded-2xl p-4 transition-colors duration-300",
            isRecording ? "bg-recording/10" : "bg-muted/50"
          )}>
            <Mic2 className={cn("h-8 w-8", isRecording ? "text-recording animate-pulse" : "opacity-25")} />
          </div>
          <p className="max-w-[28ch] text-center text-sm leading-relaxed text-balance">
            {isRecording
              ? "Listening… speak or play audio from your computer."
              : "Press Start to transcribe audio, or use Load / Paste to bring in text."}
          </p>
        </div>
      ) : isEditing ? (
        <textarea
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
          className="min-h-[min(50dvh,20rem)] w-full min-w-0 resize-none bg-transparent text-foreground outline-none wrap-anywhere sm:min-h-72"
          spellCheck={false}
          placeholder="Edit transcript here..."
        />
      ) : (
        <>
          <span className="whitespace-pre-wrap wrap-anywhere text-foreground">
            {renderHighlightedTranscript(transcript, vocabulary)}
          </span>
          {interimTranscript && (
            <span className={cn("text-muted-foreground/70", isRecording && "animate-pulse")}>
              {" "}{interimTranscript}
            </span>
          )}
          <div ref={bottomRef} />
        </>
      )}
    </div>
  )
}

function renderHighlightedTranscript(text: string, vocabulary: VocabularyItem[]) {
  if (!text || vocabulary.length === 0) return text

  const terms = Array.from(
    new Map(
      vocabulary
        .map((v) => [v.word.trim().toLowerCase(), v] as const)
        .filter(([w]) => w.length > 1)
    ).values()
  ).sort((a, b) => b.word.length - a.word.length)

  if (terms.length === 0) return text

  const escaped = terms.map((t) => escapeRegExp(t.word.trim())).filter(Boolean)
  if (escaped.length === 0) return text

  const matcher = new RegExp(`(${escaped.join("|")})`, "gi")
  const chunks = text.split(matcher)

  return chunks.map((chunk, idx) => {
    const match = terms.find((t) => t.word.trim().toLowerCase() === chunk.toLowerCase())
    if (!match) return chunk
    const colorClass =
      match.type === "word"
        ? "bg-primary/15 text-primary border-primary/30"
        : "bg-accent/20 text-accent-foreground border-accent/40"
    return (
      <span
        key={`${chunk}-${idx}`}
        className={cn("inline-block rounded-full border px-1.5 py-0.5 mx-px", colorClass)}
      >
        {chunk}
      </span>
    )
  })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
