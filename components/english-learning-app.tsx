"use client"

import { useState, useCallback, useEffect } from "react"
import { useTranscription } from "@/hooks/use-transcription"
import { TranscriptPanel } from "@/components/transcript-panel"
import { RecordingControls } from "@/components/recording-controls"
import { VocabularyCard } from "@/components/vocabulary-card"
import { ConversationHistory } from "@/components/conversation-history"
import { ManualAddForm } from "@/components/manual-add-form"
import { VocabularyItem, Conversation, ExtractedItem } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import {
  BookOpen,
  Plus,
  History,
  GraduationCap,
  Loader2,
  AlertCircle,
  MousePointerClick,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function EnglishLearningApp() {
  // Transcription state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)

  // Vocabulary state
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([])
  const [isLoadingVocab, setIsLoadingVocab] = useState(false)
  const [translatingId, setTranslatingId] = useState<string | null>(null)

  // Manual add state
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [manualWord, setManualWord] = useState("")
  const [isSubmittingManual, setIsSubmittingManual] = useState(false)

  // History state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  // Transcription hook
  const { status, loadingProgress, loadingFile, transcript, interimTranscript, isRecording, duration, audioSource, start, stop, reset, setTranscript } =
    useTranscription({
      onError: (msg) => toast.error(msg),
    })

  // Load conversations on mount
  useEffect(() => {
    fetchConversations()
    fetchVocabulary()
  }, [])

  async function fetchConversations() {
    const res = await fetch("/api/conversations")
    if (res.ok) {
      const data = await res.json()
      setConversations(data)
    }
  }

  async function fetchVocabulary(conversationId?: string) {
    setIsLoadingVocab(true)
    const url = conversationId ? `/api/vocabulary?conversation_id=${conversationId}` : "/api/vocabulary"
    const res = await fetch(url)
    if (res.ok) {
      setVocabulary(await res.json())
    }
    setIsLoadingVocab(false)
  }

  // Handle text selection from transcript for manual save
  const handleTextSelect = useCallback((text: string) => {
    setManualWord(text)
    setShowManualAdd(true)
  }, [])

  // Save session + auto-extract vocabulary
  const handleSave = useCallback(async () => {
    if (!transcript.trim()) return
    setIsSaving(true)
    try {
      // 1) Save conversation
      const saveRes = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Session — ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
          transcript: transcript,
          duration_seconds: duration,
        }),
      })
      if (!saveRes.ok) throw new Error("Failed to save conversation")
      const savedConv: Conversation = await saveRes.json()
      setCurrentConversationId(savedConv.id)
      toast.success("Session saved!")
      await fetchConversations()

      // 2) Auto-extract vocabulary with Gemini
      setIsSaving(false)
      setIsExtracting(true)
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      })
      if (!extractRes.ok) throw new Error("Extraction failed")
      const { items }: { items: ExtractedItem[] } = await extractRes.json()

      if (items.length === 0) {
        toast.info("No new vocabulary items found in this transcript.")
      } else {
        // 3) Save each extracted item
        const savePromises = items.map((item) =>
          fetch("/api/vocabulary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversation_id: savedConv.id,
              word: item.word,
              type: item.type,
              definition: item.definition,
              example_sentence: item.example_sentence,
              context: item.context,
            }),
          }).then((r) => r.json())
        )
        const saved = await Promise.all(savePromises)
        setVocabulary((prev) => [...saved, ...prev])
        toast.success(`Extracted ${items.length} vocabulary item${items.length !== 1 ? "s" : ""}!`)
      }

      // Reset for next session
      reset()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsSaving(false)
      setIsExtracting(false)
    }
  }, [transcript, duration, reset])

  // Manual add from form
  const handleManualAdd = useCallback(
    async (item: { word: string; type: string; definition: string; context: string }) => {
      setIsSubmittingManual(true)
      try {
        const res = await fetch("/api/vocabulary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: currentConversationId,
            ...item,
          }),
        })
        if (!res.ok) throw new Error("Failed to add item")
        const saved: VocabularyItem = await res.json()
        setVocabulary((prev) => [saved, ...prev])
        setShowManualAdd(false)
        setManualWord("")
        toast.success(`"${saved.word}" added to vocabulary!`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        toast.error(msg)
      } finally {
        setIsSubmittingManual(false)
      }
    },
    [currentConversationId]
  )

  // Delete vocabulary item
  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/vocabulary/${id}`, { method: "DELETE" })
    if (res.ok) {
      setVocabulary((prev) => prev.filter((v) => v.id !== id))
      toast.success("Item removed")
    }
  }, [])

  // Toggle mastered
  const handleToggleMastered = useCallback(async (id: string, current: boolean) => {
    const res = await fetch(`/api/vocabulary/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_mastered: !current }),
    })
    if (res.ok) {
      const updated: VocabularyItem = await res.json()
      setVocabulary((prev) => prev.map((v) => (v.id === id ? updated : v)))
    }
  }, [])

  // Translate to Korean via Gemini
  const handleTranslate = useCallback(async (item: VocabularyItem) => {
    setTranslatingId(item.id)
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: item.word,
          type: item.type,
          definition: item.definition,
          example_sentence: item.example_sentence,
          context: item.context,
        }),
      })
      if (!res.ok) throw new Error("Translation failed")
      const data = await res.json()
      // Save the Korean translation back to DB
      const patchRes = await fetch(`/api/vocabulary/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ korean_translation: data.korean_translation }),
      })
      if (patchRes.ok) {
        const updated: VocabularyItem = await patchRes.json()
        setVocabulary((prev) => prev.map((v) => (v.id === item.id ? updated : v)))
        toast.success(`Korean translation added for "${item.word}"`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setTranslatingId(null)
    }
  }, [])

  // Load a past conversation
  const handleSelectConversation = useCallback(async (conv: Conversation) => {
    setSelectedConversationId(conv.id)
    setTranscript(conv.transcript)
    setCurrentConversationId(conv.id)
    await fetchVocabulary(conv.id)
  }, [setTranscript])

  const masteredCount = vocabulary.filter((v) => v.is_mastered).length

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold leading-none text-foreground">EnglishLens</h1>
            <p className="text-xs text-muted-foreground">Real-time transcription + vocabulary builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "loading_model" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>
                {loadingProgress > 0
                  ? `Loading Whisper model ${loadingProgress}%`
                  : "Downloading Whisper model..."}
              </span>
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-3 py-1.5 rounded-full">
              <AlertCircle className="h-3 w-3" />
              Model error — using Web Speech fallback
            </div>
          )}
          <Badge variant="outline" className="text-xs gap-1 hidden sm:flex">
            <BookOpen className="h-3 w-3" />
            {vocabulary.length} words · {masteredCount} mastered
          </Badge>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Transcription */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-border p-4 gap-3">
          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <RecordingControls
                isRecording={isRecording}
                isLoading={status === "loading_model"}
                isSaving={isSaving}
                isExtracting={isExtracting}
                duration={duration}
                audioSource={audioSource}
                onStart={start}
                onStop={stop}
                onSave={handleSave}
                hasTranscript={transcript.length > 20}
              />
            </div>
            {!isRecording && transcript && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MousePointerClick className="h-3 w-3" />
                Select text to save a word
              </p>
            )}
          </div>

          {/* Model loading progress */}
          {status === "loading_model" && loadingFile && (
            <div className="shrink-0 bg-muted rounded-lg px-3 py-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="truncate">{loadingFile}</span>
                <span>{loadingProgress}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-1">
                <div
                  className="bg-primary h-1 rounded-full transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Transcript */}
          <TranscriptPanel
            transcript={transcript}
            interimTranscript={interimTranscript}
            isRecording={isRecording}
            onTextSelect={handleTextSelect}
          />

          {/* Manual add form (shown when text selected) */}
          {showManualAdd && (
            <div className="shrink-0">
              <ManualAddForm
                initialWord={manualWord}
                onAdd={handleManualAdd}
                onCancel={() => { setShowManualAdd(false); setManualWord("") }}
                isSubmitting={isSubmittingManual}
              />
            </div>
          )}
        </div>

        {/* Right panel: Vocabulary + History */}
        <div className="w-80 xl:w-96 flex flex-col border-l border-border shrink-0">
          <Tabs defaultValue="vocabulary" className="flex flex-col flex-1 min-h-0">
            <div className="border-b border-border px-4 pt-2 shrink-0">
              <TabsList className="w-full">
                <TabsTrigger value="vocabulary" className="flex-1 gap-1.5 text-xs">
                  <BookOpen className="h-3.5 w-3.5" />
                  Vocabulary
                  {vocabulary.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-4 px-1 min-w-4">
                      {vocabulary.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 gap-1.5 text-xs">
                  <History className="h-3.5 w-3.5" />
                  History
                  {conversations.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-4 px-1 min-w-4">
                      {conversations.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Vocabulary tab */}
            <TabsContent value="vocabulary" className="flex-1 flex flex-col min-h-0 m-0 p-0">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {selectedConversationId ? "This session" : "All items"}
                  </p>
                  {selectedConversationId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-xs px-1.5 text-muted-foreground"
                      onClick={() => {
                        setSelectedConversationId(null)
                        fetchVocabulary()
                      }}
                    >
                      Show all
                    </Button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => { setShowManualAdd(true); setManualWord("") }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-3 flex flex-col gap-2">
                  {isLoadingVocab ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : vocabulary.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                      <BookOpen className="h-8 w-8 opacity-30" />
                      <p className="text-xs text-center text-balance leading-relaxed">
                        Vocabulary items will appear here after you stop and save a recording.
                        You can also manually highlight text from the transcript.
                      </p>
                    </div>
                  ) : (
                    <>
                      {vocabulary.map((item) => (
                        <VocabularyCard
                          key={item.id}
                          item={item}
                          onDelete={handleDelete}
                          onToggleMastered={handleToggleMastered}
                          onTranslate={handleTranslate}
                          isTranslating={translatingId === item.id}
                        />
                      ))}
                      {masteredCount > 0 && (
                        <p className="text-center text-xs text-muted-foreground py-2">
                          {masteredCount} of {vocabulary.length} mastered
                        </p>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* History tab */}
            <TabsContent value="history" className="flex-1 min-h-0 m-0 p-0">
              <div className="h-full p-3">
                <ConversationHistory
                  conversations={conversations}
                  selectedId={selectedConversationId}
                  onSelect={handleSelectConversation}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Toaster position="bottom-right" richColors />
    </div>
  )
}
