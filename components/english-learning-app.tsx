"use client"

import { useState, useCallback, useEffect } from "react"
import { useTranscription } from "@/hooks/use-transcription"
import { TranscriptPanel } from "@/components/transcript-panel"
import { RecordingControls } from "@/components/recording-controls"
import { VocabularyCard } from "@/components/vocabulary-card"
import { ConversationHistory } from "@/components/conversation-history"
import { ManualAddForm } from "@/components/manual-add-form"
import { ConfigDialog } from "@/components/config-dialog"
import { VocabularyItem, Conversation, ExtractedItem, ConversationGroup } from "@/lib/types"
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
  Settings2,
  Database,
  HardDrive,
  Pencil,
  Check,
  Languages,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getStorageConfig, StorageConfig } from "@/lib/storage-config"
import {
  localGetConversations,
  localCreateConversation,
  localUpdateConversationTitle,
  localUpdateConversationTranscript,
  localDeleteConversation,
  localGetConversationGroups,
  localCreateConversationGroup,
  localDeleteConversationGroup,
  localGetVocabulary,
  localCreateVocabularyItem,
  localUpdateVocabularyItem,
  localDeleteVocabularyItem,
} from "@/lib/local-storage-db"

export function EnglishLearningApp() {
  // Storage config
  const [storageConfig, setStorageConfig] = useState<StorageConfig>(() => getStorageConfig())
  const [showConfig, setShowConfig] = useState(false)
  const isLocal = storageConfig.mode === "local"

  // Transcription state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [isTranslatingRecent, setIsTranslatingRecent] = useState(false)
  const [recentTranslation, setRecentTranslation] = useState<{ source: string; korean: string } | null>(null)

  // Vocabulary state
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([])
  const [vocabFilter, setVocabFilter] = useState<"all" | "word" | "idiom">("all")
  const [isLoadingVocab, setIsLoadingVocab] = useState(false)
  const [translatingId, setTranslatingId] = useState<string | null>(null)

  // Manual add state
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [manualWord, setManualWord] = useState("")
  const [isSubmittingManual, setIsSubmittingManual] = useState(false)
  const [isTranslatingSelectedText, setIsTranslatingSelectedText] = useState(false)
  const [translatedSelectedText, setTranslatedSelectedText] = useState<string | null>(null)

  // History state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationGroups, setConversationGroups] = useState<ConversationGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  // Transcription hook
  const { status, loadingProgress, loadingFile, transcript, interimTranscript, isRecording, duration, audioSource, debugInfo, start, stop, reset, setTranscript } =
    useTranscription({
      onError: (msg) => toast.error(msg),
      whisperModel: storageConfig.whisperModel,
    })

  // Reload data when storage mode changes
  useEffect(() => {
    fetchConversations()
    fetchVocabulary()
    setConversationGroups(localGetConversationGroups())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageConfig.mode])

  async function fetchConversations() {
    if (isLocal) {
      setConversations(localGetConversations())
      setConversationGroups(localGetConversationGroups())
      return
    }
    const res = await fetch("/api/conversations")
    if (res.ok) {
      const data = await res.json()
      setConversations(data)
    }
  }

  async function fetchVocabulary(conversationId?: string) {
    setIsLoadingVocab(true)
    if (isLocal) {
      setVocabulary(localGetVocabulary(conversationId))
      setIsLoadingVocab(false)
      return
    }
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
    setTranslatedSelectedText(null)
    setShowManualAdd(true)
  }, [])

  const handleTranslateSelectedText = useCallback(async (text: string) => {
    const input = text.trim()
    if (!input) return
    setIsTranslatingSelectedText(true)
    try {
      const res = await fetch("/api/translate-recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: input }),
      })
      if (!res.ok) throw new Error("Failed to translate selected text")
      const data = await res.json()
      setTranslatedSelectedText(typeof data?.korean_translation === "string" ? data.korean_translation : "")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsTranslatingSelectedText(false)
    }
  }, [])

  // Save session + auto-extract vocabulary
  const handleSave = useCallback(async () => {
    if (!transcript.trim()) return
    setIsSaving(true)
    try {
      const sessionTitle = `Session — ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`

      // 1) Save conversation (local or remote)
      let savedConv: Conversation
      if (isLocal) {
        savedConv = localCreateConversation(sessionTitle, transcript, duration)
        setConversations((prev) => [savedConv, ...prev])
      } else {
        const saveRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: sessionTitle, transcript, duration_seconds: duration }),
        })
        if (!saveRes.ok) throw new Error("Failed to save conversation")
        savedConv = await saveRes.json()
        await fetchConversations()
      }
      setCurrentConversationId(savedConv.id)
      toast.success("Session saved!")

      // 2) Auto-extract vocabulary with Gemini
      setIsSaving(false)
      setIsExtracting(true)
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      })
      if (!extractRes.ok) {
        let message = "Extraction failed"
        try {
          const body = await extractRes.json()
          if (typeof body?.error === "string" && body.error) message = body.error
        } catch {}
        throw new Error(message)
      }
      const { items }: { items: ExtractedItem[] } = await extractRes.json()

      if (items.length === 0) {
        toast.info("No new vocabulary items found in this transcript.")
      } else {
        // 3) Save each extracted item (local or remote)
        let saved: VocabularyItem[]
        if (isLocal) {
          saved = items.map((item) =>
            localCreateVocabularyItem({
              conversation_id: savedConv.id,
              word: item.word,
              type: normalizeVocabType(item.type),
              definition: item.definition,
              example_sentence: item.example_sentence,
              context: item.context,
              korean_translation: null,
            })
          )
        } else {
          const savePromises = items.map((item) =>
            fetch("/api/vocabulary", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversation_id: savedConv.id,
                word: item.word,
                type: normalizeVocabType(item.type),
                definition: item.definition,
                example_sentence: item.example_sentence,
                context: item.context,
              }),
            }).then((r) => r.json())
          )
          saved = await Promise.all(savePromises)
        }
        setVocabulary((prev) => [...saved, ...prev])
        toast.success(`Extracted ${items.length} vocabulary item${items.length !== 1 ? "s" : ""}!`)
      }

      reset()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsSaving(false)
      setIsExtracting(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, duration, reset, isLocal])

  // Manual add from form
  const handleManualAdd = useCallback(
    async (item: { word: string; type: string; definition: string; context: string }) => {
      setIsSubmittingManual(true)
      try {
        let saved: VocabularyItem
        if (isLocal) {
          saved = localCreateVocabularyItem({
            conversation_id: currentConversationId,
            word: item.word,
            type: normalizeVocabType(item.type as VocabularyItem["type"]),
            definition: item.definition,
            example_sentence: null,
            context: item.context,
            korean_translation: null,
          })
        } else {
          const res = await fetch("/api/vocabulary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversation_id: currentConversationId,
              ...item,
              type: normalizeVocabType(item.type as VocabularyItem["type"]),
            }),
          })
          if (!res.ok) throw new Error("Failed to add item")
          saved = await res.json()
        }
        setVocabulary((prev) => [saved, ...prev])
        setShowManualAdd(false)
        setManualWord("")
        setTranslatedSelectedText(null)
        toast.success(`"${saved.word}" added to vocabulary!`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        toast.error(msg)
      } finally {
        setIsSubmittingManual(false)
      }
    },
    [currentConversationId, isLocal]
  )

  // Delete vocabulary item
  const handleDelete = useCallback(async (id: string) => {
    if (isLocal) {
      localDeleteVocabularyItem(id)
      setVocabulary((prev) => prev.filter((v) => v.id !== id))
      toast.success("Item removed")
      return
    }
    const res = await fetch(`/api/vocabulary/${id}`, { method: "DELETE" })
    if (res.ok) {
      setVocabulary((prev) => prev.filter((v) => v.id !== id))
      toast.success("Item removed")
    }
  }, [isLocal])

  // Toggle mastered
  const handleToggleMastered = useCallback(async (id: string, current: boolean) => {
    if (isLocal) {
      const updated = localUpdateVocabularyItem(id, { is_mastered: !current })
      if (updated) setVocabulary((prev) => prev.map((v) => (v.id === id ? updated : v)))
      return
    }
    const res = await fetch(`/api/vocabulary/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_mastered: !current }),
    })
    if (res.ok) {
      const updated: VocabularyItem = await res.json()
      setVocabulary((prev) => prev.map((v) => (v.id === id ? updated : v)))
    }
  }, [isLocal])

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
      const koreanTranslation: string = data.korean_translation

      if (isLocal) {
        const updated = localUpdateVocabularyItem(item.id, { korean_translation: koreanTranslation })
        if (updated) {
          setVocabulary((prev) => prev.map((v) => (v.id === item.id ? updated : v)))
          toast.success(`Korean translation added for "${item.word}"`)
        }
      } else {
        const patchRes = await fetch(`/api/vocabulary/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ korean_translation: koreanTranslation }),
        })
        if (patchRes.ok) {
          const updated: VocabularyItem = await patchRes.json()
          setVocabulary((prev) => prev.map((v) => (v.id === item.id ? updated : v)))
          toast.success(`Korean translation added for "${item.word}"`)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setTranslatingId(null)
    }
  }, [isLocal])

  const handleTranslateRecent = useCallback(async () => {
    const input = `${transcript} ${interimTranscript}`.trim()
    if (!input) return
    setIsTranslatingRecent(true)
    try {
      const res = await fetch("/api/translate-recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: input }),
      })
      if (!res.ok) throw new Error("Failed to translate recent lines")
      const data = await res.json()
      setRecentTranslation({
        source: typeof data?.source === "string" ? data.source : "",
        korean: typeof data?.korean_translation === "string" ? data.korean_translation : "",
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsTranslatingRecent(false)
    }
  }, [transcript, interimTranscript])

  // Load a past conversation
  const handleSelectConversation = useCallback(async (conv: Conversation) => {
    setSelectedConversationId(conv.id)
    setTranscript(conv.transcript)
    setCurrentConversationId(conv.id)
    if (isLocal) {
      setVocabulary(localGetVocabulary(conv.id))
    } else {
      await fetchVocabulary(conv.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTranscript, isLocal])

  const handleRenameConversation = useCallback(async (conv: Conversation, nextTitle: string) => {
    const title = nextTitle.trim()
    if (!title) return

    try {
      if (isLocal) {
        const updated = localUpdateConversationTitle(conv.id, title)
        if (!updated) throw new Error("Failed to rename session")
        setConversations((prev) => prev.map((c) => (c.id === conv.id ? updated : c)))
      } else {
        const res = await fetch(`/api/conversations/${conv.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        })
        if (!res.ok) throw new Error("Failed to rename session")
        const updated: Conversation = await res.json()
        setConversations((prev) => prev.map((c) => (c.id === conv.id ? updated : c)))
      }

      toast.success("Session title updated")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    }
  }, [isLocal])

  const handleDeleteConversation = useCallback(async (conv: Conversation) => {
    try {
      if (isLocal) {
        localDeleteConversation(conv.id)
        setConversationGroups(localGetConversationGroups())
      } else {
        const res = await fetch(`/api/conversations/${conv.id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete session")
      }

      setConversations((prev) => prev.filter((c) => c.id !== conv.id))
      setVocabulary((prev) => prev.filter((v) => v.conversation_id !== conv.id))

      if (selectedConversationId === conv.id) {
        setSelectedConversationId(null)
        setCurrentConversationId(null)
        setTranscript("")
        if (isLocal) {
          setVocabulary(localGetVocabulary())
        } else {
          void fetchVocabulary()
        }
      }

      toast.success("Session deleted")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    }
  }, [isLocal, selectedConversationId, setTranscript])

  const handleCreateGroup = useCallback(async (name: string, conversationIds: string[]) => {
    if (conversationIds.length < 2) return
    if (!isLocal) {
      toast.info("Session grouping is currently stored locally.")
    }
    const created = localCreateConversationGroup(name, conversationIds)
    setConversationGroups((prev) => [created, ...prev])
    setSelectedGroupId(created.id)
    toast.success("Group created")
  }, [isLocal])

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    localDeleteConversationGroup(groupId)
    setConversationGroups((prev) => prev.filter((g) => g.id !== groupId))
    if (selectedGroupId === groupId) setSelectedGroupId(null)
    toast.success("Group deleted")
  }, [selectedGroupId])

  const handleToggleEditTranscript = useCallback(async () => {
    if (!isEditingTranscript) {
      setIsEditingTranscript(true)
      return
    }

    // Done: persist edited transcript for currently selected/saved session.
    const targetConversationId = selectedConversationId ?? currentConversationId
    if (!targetConversationId) {
      setIsEditingTranscript(false)
      return
    }

    try {
      if (isLocal) {
        const updated = localUpdateConversationTranscript(targetConversationId, transcript)
        if (updated) {
          setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        }
      } else {
        const res = await fetch(`/api/conversations/${targetConversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript }),
        })
        if (!res.ok) throw new Error("Failed to save edited transcript")
        const updated: Conversation = await res.json()
        setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      }
      toast.success("Transcript updated")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsEditingTranscript(false)
    }
  }, [isEditingTranscript, selectedConversationId, currentConversationId, isLocal, transcript])

  const masteredCount = vocabulary.filter((v) => v.is_mastered).length
  const wordCount = vocabulary.filter((v) => v.type === "word").length
  const idiomCount = vocabulary.length - wordCount
  const filteredVocabulary = vocabulary.filter((item) => {
    if (vocabFilter === "all") return true
    if (vocabFilter === "word") return item.type === "word"
    return item.type !== "word"
  })

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
          {/* Storage mode badge */}
          <Badge
            variant="outline"
            className={cn(
              "text-xs gap-1 hidden sm:flex",
              isLocal
                ? "text-muted-foreground border-border"
                : "text-primary border-primary/30 bg-primary/5"
            )}
          >
            {isLocal ? <HardDrive className="h-3 w-3" /> : <Database className="h-3 w-3" />}
            {isLocal ? "Local" : "Supabase"}
          </Badge>
          {/* Config button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setShowConfig(true)}
            title="Storage configuration"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
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
                isLoading={status === "loading_model" && !isRecording}
                isSaving={isSaving}
                isExtracting={isExtracting}
                duration={duration}
                audioSource={audioSource}
                onStart={start}
                onStop={stop}
                onSave={handleSave}
                onNew={() => {
                  reset()
                  setCurrentConversationId(null)
                  setSelectedConversationId(null)
                  setIsEditingTranscript(false)
                  setShowManualAdd(false)
                  setManualWord("")
                }}
                hasTranscript={transcript.length > 20}
              />
            </div>
            {!isRecording && transcript && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => void handleToggleEditTranscript()}
                >
                  {isEditingTranscript ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  {isEditingTranscript ? "Done" : "Edit"}
                </Button>
                {!isEditingTranscript && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MousePointerClick className="h-3 w-3" />
                    Select text to save a word
                  </p>
                )}
              </div>
            )}
            {transcript && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 gap-1.5 text-xs"
                onClick={handleTranslateRecent}
                disabled={isTranslatingRecent}
              >
                {isTranslatingRecent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                가장 최근 2-3문장 번역
              </Button>
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
          {recentTranslation?.korean && (
            <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-[11px] text-muted-foreground mb-1">Recent</p>
              <p className="text-xs text-foreground mb-1">{recentTranslation.source}</p>
              <p className="text-sm font-medium text-primary">{recentTranslation.korean}</p>
            </div>
          )}
          <TranscriptPanel
            transcript={transcript}
            interimTranscript={interimTranscript}
            isRecording={isRecording}
            isEditing={isEditingTranscript && !isRecording}
            vocabulary={vocabulary}
            onTranscriptChange={setTranscript}
            onTextSelect={handleTextSelect}
          />
          {isRecording && (
            <p className="text-[11px] text-muted-foreground font-mono">
              dbg frames:{debugInfo.framesCaptured} chunks:{debugInfo.chunksSent} level:{debugInfo.audioLevel.toFixed(4)} worker:{debugInfo.workerState}
              {debugInfo.lastWorkerError ? ` err:${debugInfo.lastWorkerError}` : ""}
            </p>
          )}

          {/* Manual add form (shown when text selected) */}
          {showManualAdd && (
            <div className="shrink-0">
              <ManualAddForm
                initialWord={manualWord}
                onAdd={handleManualAdd}
                onTranslateSelected={handleTranslateSelectedText}
                translatedSelectedText={translatedSelectedText}
                isTranslatingSelected={isTranslatingSelectedText}
                onCancel={() => { setShowManualAdd(false); setManualWord(""); setTranslatedSelectedText(null) }}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-medium text-muted-foreground">
                    {selectedConversationId ? "This session" : "All items"}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={vocabFilter === "all" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setVocabFilter("all")}
                    >
                      All {vocabulary.length}
                    </Button>
                    <Button
                      variant={vocabFilter === "word" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setVocabFilter("word")}
                    >
                      Words {wordCount}
                    </Button>
                    <Button
                      variant={vocabFilter === "idiom" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setVocabFilter("idiom")}
                    >
                      Idioms {idiomCount}
                    </Button>
                  </div>
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
                <div className="p-2 flex flex-col gap-1">
                  {isLoadingVocab ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredVocabulary.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                      <BookOpen className="h-8 w-8 opacity-30" />
                      <p className="text-xs text-center text-balance leading-relaxed">
                        No items in this filter yet.
                      </p>
                    </div>
                  ) : (
                    <>
                      {filteredVocabulary.map((item) => (
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
                  groups={conversationGroups}
                  selectedGroupId={selectedGroupId}
                  selectedId={selectedConversationId}
                  onSelect={handleSelectConversation}
                  onRename={handleRenameConversation}
                  onDelete={handleDeleteConversation}
                  onCreateGroup={handleCreateGroup}
                  onDeleteGroup={handleDeleteGroup}
                  onSelectGroup={setSelectedGroupId}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Config dialog */}
      <ConfigDialog
        open={showConfig}
        onOpenChange={setShowConfig}
        onSave={(cfg) => {
          setStorageConfig(cfg)
          toast.success(`Storage switched to ${cfg.mode === "local" ? "Local (browser)" : "Supabase"}`)
        }}
      />

      <Toaster position="bottom-right" richColors />
    </div>
  )
}

function normalizeVocabType(type: VocabularyItem["type"]): VocabularyItem["type"] {
  return type === "word" ? "word" : "idiom"
}
