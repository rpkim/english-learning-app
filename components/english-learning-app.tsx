"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { AudioInputSource, useTranscription } from "@/hooks/use-transcription"
import { TranscriptPanel } from "@/components/transcript-panel"
import { RecordingControls } from "@/components/recording-controls"
import { VocabularyCard } from "@/components/vocabulary-card"
import { ConversationHistory } from "@/components/conversation-history"
import { ManualAddForm } from "@/components/manual-add-form"
import { ConfigDialog } from "@/components/config-dialog"
import { VocabularyItem, Conversation, ExtractedItem, ConversationGroup } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { jsPDF } from "jspdf"
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
  Globe,
  Monitor,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  PinOff,
  Minimize2,
  Maximize2,
  EyeOff,
  FileDown,
  Lock,
  WandSparkles,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { getStorageConfig, saveStorageConfig, StorageConfig } from "@/lib/storage-config"
import {
  localGetConversations,
  localCreateConversation,
  localUpdateConversationTitle,
  localUpdateConversationTranscript,
  localDeleteConversation,
  localGetConversationGroups,
  localCreateConversationGroup,
  localUpdateConversationGroupName,
  localDeleteConversationGroup,
  localArchiveConversationGroup,
  localRestoreConversationGroup,
  localMoveConversationToGroup,
  localGetVocabulary,
  localCreateVocabularyItem,
  localUpdateVocabularyItem,
  localDeleteVocabularyItem,
} from "@/lib/local-storage-db"

export function EnglishLearningApp() {
  const UNLOCK_SESSION_KEY = "surviveenglish_app_unlocked"

  // Storage config
  const [storageConfig, setStorageConfig] = useState<StorageConfig>(() => getStorageConfig())
  const [showConfig, setShowConfig] = useState(false)
  const isLocal = storageConfig.mode === "local"
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState("")
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  // Transcription state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isCurrentTranscriptSaved, setIsCurrentTranscriptSaved] = useState(false)
  const [showStartSourceDialog, setShowStartSourceDialog] = useState(false)
  const [startViewMode, setStartViewMode] = useState<"compact" | "full">("full")
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [isTranslatingRecent, setIsTranslatingRecent] = useState(false)
  const [recentSnippet, setRecentSnippet] = useState("")
  const [recentSnippetTranslation, setRecentSnippetTranslation] = useState("")
  const [diarizedItems, setDiarizedItems] = useState<Array<{ text: string; speaker: "A" | "B" }>>([])
  const [isDiarizing, setIsDiarizing] = useState(false)
  const [speakerAssignmentsByConversation, setSpeakerAssignmentsByConversation] = useState<Record<string, Record<string, "A" | "B">>>({})
  const [speakerLabelsByConversation, setSpeakerLabelsByConversation] = useState<Record<string, { A: string; B: string }>>({})

  // Vocabulary state
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([])
  const [vocabFilter, setVocabFilter] = useState<"all" | "word" | "idiom" | "slang">("all")
  const [vocabView, setVocabView] = useState<"items" | "frequency">("items")
  const [isLoadingVocab, setIsLoadingVocab] = useState(false)
  const [translatingId, setTranslatingId] = useState<string | null>(null)
  const [isBatchTranslating, setIsBatchTranslating] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

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
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [leftPanelWidthPct, setLeftPanelWidthPct] = useState(58)
  const [isDesktop, setIsDesktop] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const [desktopViewMode, setDesktopViewMode] = useState<"compact" | "full">("full")

  // Transcription hook
  const { status, loadingProgress, loadingFile, transcript, interimTranscript, isRecording, duration, audioSource, debugInfo, utterances, recordedAudioBlob, isRefining, start, stop, reset, refineTranscript, downloadRecording, setTranscript } =
    useTranscription({
      onError: (msg) => toast.error(msg),
      whisperModel: storageConfig.whisperModel,
    })

  useEffect(() => {
    let cancelled = false
    const initAuth = async () => {
      if (typeof window === "undefined") return
      try {
        const res = await fetch("/api/auth/unlock", { method: "GET" })
        const data = await res.json().catch(() => ({}))
        const enabled = data?.enabled === true
        if (cancelled) return
        if (!enabled) {
          setIsUnlocked(true)
          setIsAuthReady(true)
          return
        }
      } catch {
        // If status check fails, fall back to lock screen behavior.
      }

      if (cancelled) return
      const unlocked = window.sessionStorage.getItem(UNLOCK_SESSION_KEY) === "true"
      setIsUnlocked(unlocked)
      setIsAuthReady(true)
    }
    void initAuth()
    return () => {
      cancelled = true
    }
  }, [])

  const handleUnlock = useCallback(async () => {
    setUnlockError(null)
    setIsUnlocking(true)
    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: unlockPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok !== true) {
        setUnlockError(typeof data?.error === "string" ? data.error : "Failed to unlock")
        return
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(UNLOCK_SESSION_KEY, "true")
      }
      setIsUnlocked(true)
      setUnlockPassword("")
    } catch {
      setUnlockError("Failed to unlock")
    } finally {
      setIsUnlocking(false)
    }
  }, [unlockPassword])

  // Reload data when storage mode changes
  useEffect(() => {
    fetchConversations()
    fetchVocabulary()
    setConversationGroups(localGetConversationGroups())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageConfig.mode])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const rawAssignments = window.localStorage.getItem("speaker_assignments_by_conversation")
      const rawLabels = window.localStorage.getItem("speaker_labels_by_conversation")
      if (rawAssignments) setSpeakerAssignmentsByConversation(JSON.parse(rawAssignments))
      if (rawLabels) setSpeakerLabelsByConversation(JSON.parse(rawLabels))
    } catch {}
  }, [])

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

  useEffect(() => {
    if (!transcript.trim()) {
      setIsCurrentTranscriptSaved(false)
    }
  }, [transcript])

  const handleTranslateSelectedText = useCallback(async (text: string) => {
    const input = text.trim()
    if (!input) return
    setIsTranslatingSelectedText(true)
    try {
      const res = await fetch("/api/translate-recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: input, provider: storageConfig.translationProvider }),
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
  }, [storageConfig.translationProvider])

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
      setIsCurrentTranscriptSaved(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsSaving(false)
      setIsExtracting(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, duration, isLocal])

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
          provider: storageConfig.translationProvider,
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
  }, [isLocal, storageConfig.translationProvider])

  const handleTranslateRecent = useCallback(async () => {
    const input = recentSnippet || extractRecentTail(`${transcript} ${interimTranscript}`.trim(), 1)
    if (!input) return
    setIsTranslatingRecent(true)
    try {
      const res = await fetch("/api/translate-recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: input, provider: storageConfig.translationProvider }),
      })
      if (!res.ok) throw new Error("Failed to translate recent lines")
      const data = await res.json()
      const korean = typeof data?.korean_translation === "string" ? data.korean_translation : ""
      setRecentSnippetTranslation(korean)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsTranslatingRecent(false)
    }
  }, [recentSnippet, transcript, interimTranscript, storageConfig.translationProvider])

  useEffect(() => {
    const combined = `${transcript} ${interimTranscript}`.trim()
    if (!combined) {
      setRecentSnippet("")
      setRecentSnippetTranslation("")
      return
    }
    const nextSnippet = extractRecentTail(combined, 1)
    setRecentSnippet((prev) => {
      if (prev !== nextSnippet) {
        setRecentSnippetTranslation("")
      }
      return nextSnippet
    })
  }, [isRecording, transcript, interimTranscript])

  const handleAutoDiarize = useCallback(async () => {
    const input = transcript.trim()
    if (!input) return
    setIsDiarizing(true)
    try {
      const res = await fetch("/api/diarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: input }),
      })
      if (!res.ok) throw new Error("Failed to diarize transcript")
      const data = await res.json()
      const items = Array.isArray(data?.items) ? data.items : []
      setDiarizedItems(items)
      toast.success(items.length > 0 ? "Speaker labels updated" : "No diarization result")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsDiarizing(false)
    }
  }, [transcript])

  const handleRefineTranscript = useCallback(async () => {
    try {
      const refined = await refineTranscript("small")
      if (refined) {
        toast.success("Transcript refined with higher-accuracy model")
      } else {
        toast.info("No refined transcript produced")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to refine transcript"
      toast.error(msg)
    }
  }, [refineTranscript])

  // Load a past conversation
  const handleSelectConversation = useCallback(async (conv: Conversation) => {
    setSelectedConversationId(conv.id)
    setTranscript(conv.transcript)
    setCurrentConversationId(conv.id)
    setIsCurrentTranscriptSaved(true)
    if (isLocal) {
      setVocabulary(localGetVocabulary(conv.id))
    } else {
      await fetchVocabulary(conv.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTranscript, isLocal])

  const activeSpeakerKey = selectedConversationId ?? currentConversationId ?? "__unsaved__"
  const activeSpeakerAssignments = speakerAssignmentsByConversation[activeSpeakerKey] ?? {}
  const activeSpeakerLabels = speakerLabelsByConversation[activeSpeakerKey] ?? { A: "Speaker A", B: "Speaker B" }

  const handleSpeakerAssignmentsChange = useCallback((map: Record<string, "A" | "B">) => {
    if (!activeSpeakerKey || activeSpeakerKey === "__unsaved__") return
    setSpeakerAssignmentsByConversation((prev) => {
      const next = { ...prev, [activeSpeakerKey]: map }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("speaker_assignments_by_conversation", JSON.stringify(next))
      }
      return next
    })
  }, [activeSpeakerKey])

  const handleSpeakerLabelsChange = useCallback((labels: { A: string; B: string }) => {
    if (!activeSpeakerKey || activeSpeakerKey === "__unsaved__") return
    setSpeakerLabelsByConversation((prev) => {
      const next = { ...prev, [activeSpeakerKey]: labels }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("speaker_labels_by_conversation", JSON.stringify(next))
      }
      return next
    })
  }, [activeSpeakerKey])

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

  const handleCreateGroup = useCallback(async (name: string) => {
    if (!isLocal) {
      toast.info("Session grouping is currently stored locally.")
    }
    const created = localCreateConversationGroup(name, [])
    setConversationGroups((prev) => [created, ...prev])
    setSelectedGroupId(created.id)
    toast.success("Workspace created")
  }, [isLocal])

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    localDeleteConversationGroup(groupId)
    setConversationGroups((prev) => prev.filter((g) => g.id !== groupId))
    if (selectedGroupId === groupId) setSelectedGroupId(null)
    toast.success("Group deleted")
  }, [selectedGroupId])

  const handleArchiveGroup = useCallback(async (groupId: string) => {
    const updated = localArchiveConversationGroup(groupId)
    if (!updated) return
    setConversationGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
    if (selectedGroupId === groupId) setSelectedGroupId(null)
    toast.success("Workspace archived")
  }, [selectedGroupId])

  const handleRestoreGroup = useCallback(async (groupId: string) => {
    const updated = localRestoreConversationGroup(groupId)
    if (!updated) return
    setConversationGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
    toast.success("Workspace restored")
  }, [])

  const handleRenameGroup = useCallback(async (groupId: string, nextName: string) => {
    const name = nextName.trim()
    if (!name) return
    const updated = localUpdateConversationGroupName(groupId, name)
    if (!updated) {
      toast.error("Failed to rename workspace")
      return
    }
    setConversationGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
    toast.success("Workspace name updated")
  }, [])

  const handleSelectGroup = useCallback((groupId: string | null) => {
    setSelectedGroupId(groupId)
    setSelectedConversationId(null)
    if (groupId) {
      setCurrentConversationId(null)
    }
    if (isLocal) {
      setVocabulary(localGetVocabulary())
    } else {
      void fetchVocabulary()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal])

  const handleMoveConversationToGroup = useCallback((conversationId: string, groupId: string | null) => {
    const updated = localMoveConversationToGroup(conversationId, groupId)
    setConversationGroups(updated)
    setSelectedGroupId(groupId)
    toast.success(groupId ? "Moved to group" : "Moved to unclassified")
  }, [])

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

  const activeGroupConversationIds = useMemo(() => {
    if (!selectedGroupId || selectedGroupId === "__ungrouped__") return null
    const group = conversationGroups.find((g) => g.id === selectedGroupId)
    return group ? new Set(group.conversation_ids) : null
  }, [selectedGroupId, conversationGroups])

  const scopedVocabulary = useMemo(() => {
    if (selectedConversationId) {
      return vocabulary.filter((v) => v.conversation_id === selectedConversationId)
    }
    if (selectedGroupId === "__ungrouped__") {
      const grouped = new Set(conversationGroups.flatMap((g) => g.conversation_ids))
      const unclassifiedConversationIds = new Set(conversations.filter((c) => !grouped.has(c.id)).map((c) => c.id))
      return vocabulary.filter((v) => v.conversation_id && unclassifiedConversationIds.has(v.conversation_id))
    }
    if (activeGroupConversationIds) {
      return vocabulary.filter((v) => v.conversation_id && activeGroupConversationIds.has(v.conversation_id))
    }
    return vocabulary
  }, [vocabulary, selectedConversationId, activeGroupConversationIds, selectedGroupId, conversationGroups, conversations])

  const handleTranslateScoped = useCallback(async () => {
    const targets = scopedVocabulary.filter((item) => {
      if (typeof item.korean_translation !== "string") return true
      return item.korean_translation.trim().length === 0
    })
    if (targets.length === 0) {
      toast.info("No untranslated items in this scope")
      return
    }

    setIsBatchTranslating(true)
    try {
      const res = await fetch("/api/translate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: storageConfig.translationProvider,
          items: targets.map((item) => ({
            id: item.id,
            word: item.word,
            type: item.type,
            definition: item.definition,
            example_sentence: item.example_sentence,
            context: item.context,
          })),
        }),
      })
      if (!res.ok) throw new Error("Batch translation failed")
      const data = await res.json()
      const translations: Record<string, string> = (data?.translations && typeof data.translations === "object")
        ? data.translations as Record<string, string>
        : {}
      const translatedIds = Object.keys(translations).filter((id) => typeof translations[id] === "string" && translations[id].trim())
      if (translatedIds.length === 0) {
        toast.info("No translations returned")
        return
      }

      if (isLocal) {
        for (const id of translatedIds) {
          localUpdateVocabularyItem(id, { korean_translation: translations[id] })
        }
      } else {
        await Promise.all(
          translatedIds.map((id) =>
            fetch(`/api/vocabulary/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ korean_translation: translations[id] }),
            })
          )
        )
      }

      setVocabulary((prev) =>
        prev.map((item) => {
          const t = translations[item.id]
          if (!t || !t.trim()) return item
          return { ...item, korean_translation: t.trim() }
        })
      )
      toast.success(`Translated ${translatedIds.length} item${translatedIds.length > 1 ? "s" : ""}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsBatchTranslating(false)
    }
  }, [scopedVocabulary, isLocal, storageConfig.translationProvider])

  const masteredCount = scopedVocabulary.filter((v) => v.is_mastered).length
  const wordCount = scopedVocabulary.filter((v) => v.type === "word").length
  const idiomCount = scopedVocabulary.filter((v) => v.type === "idiom").length
  const slangCount = scopedVocabulary.filter((v) => v.type === "slang").length
  const filteredVocabulary = scopedVocabulary.filter((item) => {
    if (vocabFilter === "all") return true
    if (vocabFilter === "word") return item.type === "word"
    if (vocabFilter === "idiom") return item.type === "idiom"
    return item.type === "slang"
  })

  const scopeConversations = useMemo(() => {
    if (selectedConversationId) {
      return conversations.filter((c) => c.id === selectedConversationId)
    }
    if (selectedGroupId === "__ungrouped__") {
      const grouped = new Set(conversationGroups.flatMap((g) => g.conversation_ids))
      return conversations.filter((c) => !grouped.has(c.id))
    }
    if (activeGroupConversationIds) {
      return conversations.filter((c) => activeGroupConversationIds.has(c.id))
    }
    return conversations
  }, [conversations, selectedConversationId, activeGroupConversationIds, selectedGroupId, conversationGroups])

  const workspaceStats = useMemo(() => {
    const stats: Record<string, { totalWords: number; masteredWords: number }> = {}
    for (const group of conversationGroups) {
      const ids = new Set(group.conversation_ids)
      const words = vocabulary.filter((v) => v.conversation_id && ids.has(v.conversation_id))
      stats[group.id] = {
        totalWords: words.length,
        masteredWords: words.filter((w) => w.is_mastered).length,
      }
    }
    return stats
  }, [conversationGroups, vocabulary])

  const frequentWords = useMemo(() => {
    const excluded = new Set((storageConfig.topWordExcludes ?? []).map((w) => w.toLowerCase()))
    const stop = new Set([
      "the","a","an","and","or","to","of","in","on","at","for","with","is","are","was","were","be","been","being",
      "it","this","that","these","those","i","you","he","she","we","they","them","his","her","our","their","my","me",
      "as","by","from","but","if","then","so","do","does","did","have","has","had","not","no","yes","can","could",
      "will","would","should","about","into","over","under","just","very","there","here","what","when","where","who",
    ])
    const counts = new Map<string, number>()
    for (const conv of scopeConversations) {
      const words = conv.transcript.toLowerCase().match(/[a-z']+/g) ?? []
      for (const w of words) {
        if (w.length < 3 || stop.has(w) || excluded.has(w)) continue
        counts.set(w, (counts.get(w) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
      .slice(0, 120)
  }, [scopeConversations, storageConfig.topWordExcludes])

  const handleExcludeTopWord = useCallback((word: string) => {
    const normalized = word.trim().toLowerCase()
    if (!normalized) return
    const prev = storageConfig.topWordExcludes ?? []
    if (prev.includes(normalized)) return
    const nextConfig: StorageConfig = {
      ...storageConfig,
      topWordExcludes: [...prev, normalized].sort(),
    }
    setStorageConfig(nextConfig)
    saveStorageConfig(nextConfig)
    toast.success(`Excluded "${normalized}" from Top words`)
  }, [storageConfig])

  const handleAddFrequentWord = useCallback(async (word: string) => {
    const already = vocabulary.some((v) => v.word.toLowerCase() === word.toLowerCase())
    if (already) {
      toast.info(`"${word}" is already in vocabulary`)
      return
    }
    try {
      let saved: VocabularyItem
      const targetConversationId = selectedConversationId ?? null
      if (isLocal) {
        saved = localCreateVocabularyItem({
          conversation_id: targetConversationId,
          word,
          type: "word",
          definition: "Frequent word from selected sessions.",
          example_sentence: null,
          context: null,
          korean_translation: null,
        })
      } else {
        const res = await fetch("/api/vocabulary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: targetConversationId,
            word,
            type: "word",
            definition: "Frequent word from selected sessions.",
            example_sentence: null,
            context: null,
          }),
        })
        if (!res.ok) throw new Error("Failed to add word")
        saved = await res.json()
      }
      setVocabulary((prev) => [saved, ...prev])
      toast.success(`"${word}" added to vocabulary`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    }
  }, [vocabulary, isLocal, selectedConversationId])

  const handleExportCsv = useCallback(() => {
    if (filteredVocabulary.length === 0) {
      toast.info("No vocabulary items to export in this scope")
      return
    }
    const header = ["word", "type", "korean_translation", "definition", "example_sentence", "context", "is_mastered"]
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const rows = filteredVocabulary.map((item) => [
      item.word,
      item.type,
      item.korean_translation ?? "",
      item.definition ?? "",
      item.example_sentence ?? "",
      item.context ?? "",
      item.is_mastered ? "true" : "false",
    ])
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `vocabulary-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success("CSV exported")
  }, [filteredVocabulary])

  const handleExportPdf = useCallback(async () => {
    if (filteredVocabulary.length === 0) {
      toast.info("No vocabulary items to export in this scope")
      return
    }
    setIsExportingPdf(true)
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 36
      let y = margin
      doc.setFont("helvetica", "bold")
      doc.setFontSize(14)
      doc.text("SurviveEnglish Vocabulary Export", margin, y)
      y += 18
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y)
      y += 18

      for (const item of filteredVocabulary) {
        const lines = [
          `${item.word} (${item.type})${item.is_mastered ? " [mastered]" : ""}`,
          item.korean_translation ? `KR: ${item.korean_translation}` : "",
          item.definition ? `Meaning: ${item.definition}` : "",
          item.example_sentence ? `Example: ${item.example_sentence}` : "",
          item.context ? `Context: ${item.context}` : "",
        ].filter(Boolean)

        for (const raw of lines) {
          const wrapped = doc.splitTextToSize(raw, pageWidth - margin * 2)
          for (const line of wrapped) {
            if (y > pageHeight - margin) {
              doc.addPage()
              y = margin
            }
            doc.text(line, margin, y)
            y += 14
          }
        }
        y += 8
      }

      doc.save(`vocabulary-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success("PDF exported")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export PDF"
      toast.error(msg)
    } finally {
      setIsExportingPdf(false)
    }
  }, [filteredVocabulary])

  const handleStartWithSource = useCallback(async (source: AudioInputSource) => {
    setShowStartSourceDialog(false)
    if (startViewMode === "compact") {
      setDesktopViewMode("compact")
      setRightCollapsed(true)
      setLeftCollapsed(false)
      setLeftPanelWidthPct(68)
      if (typeof window !== "undefined") {
        await (window as Window & { desktop?: { setViewMode?: (mode: "compact" | "full") => Promise<boolean> } }).desktop?.setViewMode?.("compact")
      }
    } else {
      setDesktopViewMode("full")
      setRightCollapsed(false)
      setLeftCollapsed(false)
      setLeftPanelWidthPct(58)
      if (typeof window !== "undefined") {
        await (window as Window & { desktop?: { setViewMode?: (mode: "compact" | "full") => Promise<boolean> } }).desktop?.setViewMode?.("full")
      }
    }
    await start(source)
  }, [start, startViewMode])

  const collapseLeftPanel = useCallback(() => {
    setLeftCollapsed(true)
    setRightCollapsed(false)
  }, [])

  const collapseRightPanel = useCallback(() => {
    setRightCollapsed(true)
    setLeftCollapsed(false)
  }, [])

  const expandLeftPanel = useCallback(() => {
    setLeftCollapsed(false)
  }, [])

  const expandRightPanel = useCallback(() => {
    setRightCollapsed(false)
  }, [])


  useEffect(() => {
    if (leftCollapsed && rightCollapsed) {
      // Never keep both panels collapsed at the same time.
      setRightCollapsed(false)
    }
  }, [leftCollapsed, rightCollapsed])

  useEffect(() => {
    if (typeof window === "undefined") return
    const desktop = (window as Window & { desktop?: { isElectron?: boolean } }).desktop
    setIsDesktop(Boolean(desktop?.isElectron))
  }, [])

  const handleToggleAlwaysOnTop = useCallback(async () => {
    const next = !alwaysOnTop
    if (typeof window !== "undefined") {
      const desktop = (window as Window & { desktop?: { setAlwaysOnTop?: (value: boolean) => Promise<boolean> } }).desktop
      if (desktop?.setAlwaysOnTop) {
        const ok = await desktop.setAlwaysOnTop(next)
        if (!ok) {
          toast.error("Failed to change always-on-top")
          return
        }
      }
    }
    setAlwaysOnTop(next)
  }, [alwaysOnTop])

  const handleToggleDesktopViewMode = useCallback(async () => {
    const next: "compact" | "full" = desktopViewMode === "compact" ? "full" : "compact"
    if (typeof window !== "undefined") {
      const desktop = (window as Window & { desktop?: { setViewMode?: (mode: "compact" | "full") => Promise<boolean> } }).desktop
      if (desktop?.setViewMode) {
        const ok = await desktop.setViewMode(next)
        if (!ok) {
          toast.error("Failed to change desktop view")
          return
        }
      }
    }
    setDesktopViewMode(next)
    if (next === "compact") {
      setRightCollapsed(true)
      setLeftCollapsed(false)
      setLeftPanelWidthPct(68)
    } else {
      setRightCollapsed(false)
      setLeftCollapsed(false)
      setLeftPanelWidthPct(58)
    }
  }, [desktopViewMode])

  if (!isAuthReady) {
    return <div className="h-screen bg-background" />
  }

  if (!isUnlocked) {
    return (
      <div className="h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Enter app password</h2>
          </div>
          <Input
            type="password"
            value={unlockPassword}
            onChange={(e) => setUnlockPassword(e.target.value)}
            placeholder="Password"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void handleUnlock()
              }
            }}
          />
          {unlockError && <p className="text-xs text-destructive">{unlockError}</p>}
          <Button className="w-full" onClick={() => void handleUnlock()} disabled={isUnlocking}>
            {isUnlocking ? "Checking..." : "Unlock"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-background text-foreground transition-[padding] duration-200",
        isRecording && audioSource === "system" ? "pt-14" : "pt-0"
      )}
    >
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold leading-none text-foreground">SurviveEngilsh</h1>
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
          {isDesktop && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => void handleToggleAlwaysOnTop()}
                title="Always on top"
              >
                {alwaysOnTop ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                {alwaysOnTop ? "Pinned" : "Pin"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => void handleToggleDesktopViewMode()}
                title="Compact or full view"
              >
                {desktopViewMode === "compact" ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                {desktopViewMode === "compact" ? "Full" : "Compact"}
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {!leftCollapsed && !rightCollapsed && (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel
              defaultSize={leftPanelWidthPct}
              minSize={25}
              maxSize={75}
              onResize={(size) => setLeftPanelWidthPct(size)}
              className="min-w-0"
            >
              <div className="flex h-full flex-col min-w-0 border-r border-border p-4 gap-3">
          {/* Controls */}
          <div className="flex flex-col gap-2 shrink-0 sticky top-0 z-20 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <RecordingControls
                isRecording={isRecording}
                isLoading={status === "loading_model" && !isRecording}
                isSaving={isSaving}
                isExtracting={isExtracting}
                duration={duration}
                audioSource={audioSource}
                onStart={() => setShowStartSourceDialog(true)}
                onStop={stop}
                onSave={handleSave}
                onNew={() => {
                  reset()
                  setCurrentConversationId(null)
                  setSelectedConversationId(null)
                  setIsEditingTranscript(false)
                  setShowManualAdd(false)
                  setManualWord("")
                  setIsCurrentTranscriptSaved(false)
                }}
                hasTranscript={transcript.length > 20}
                isSaved={isCurrentTranscriptSaved}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={collapseLeftPanel}
                title="Collapse transcription panel"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            {(isRecording || transcript) && (
              <div className="flex flex-wrap items-center gap-2">
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
                {recordedAudioBlob && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => void handleRefineTranscript()}
                      disabled={isRefining}
                    >
                      {isRefining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                      {isRefining ? "Refining..." : "Re-transcribe (HQ)"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-xs"
                      onClick={downloadRecording}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Audio
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => void handleAutoDiarize()}
                  disabled={isDiarizing}
                >
                  {isDiarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                  {isDiarizing ? "Labeling..." : "Auto label speakers"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => void handleTranslateRecent()}
                  disabled={isTranslatingRecent || !recentSnippet}
                >
                  {isTranslatingRecent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                  Translate recent
                </Button>
              </div>
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
          {recentSnippet && (
            <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-[11px] text-muted-foreground mb-1">{isRecording ? "Live" : "Recent"}</p>
              <p className="text-sm text-foreground">{recentSnippet}</p>
              {recentSnippetTranslation && <p className="mt-1 text-sm font-medium text-primary">{recentSnippetTranslation}</p>}
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
            </ResizablePanel>
            <ResizableHandle withHandle className="bg-border/80 hover:bg-primary/40 data-dragging:bg-primary/50" />
            <ResizablePanel defaultSize={100 - leftPanelWidthPct} minSize={25} maxSize={75} className="min-w-0">
              <div className="flex h-full flex-col border-l border-border min-w-0">
                <Tabs defaultValue="vocabulary" className="flex flex-col flex-1 min-h-0">
                  <div className="border-b border-border px-4 pt-2 shrink-0">
                    <div className="mb-2 flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={collapseRightPanel}
                        title="Collapse right panel"
                      >
                        <PanelRightClose className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <TabsList className="w-full">
                      <TabsTrigger value="vocabulary" className="flex-1 gap-1.5 text-xs">
                        <BookOpen className="h-3.5 w-3.5" />
                        Vocabulary
                        {scopedVocabulary.length > 0 && (
                          <Badge variant="secondary" className="text-xs h-4 px-1 min-w-4">
                            {scopedVocabulary.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="history" className="flex-1 gap-1.5 text-xs">
                        <History className="h-3.5 w-3.5" />
                        Workspace
                        {conversations.length > 0 && (
                          <Badge variant="secondary" className="text-xs h-4 px-1 min-w-4">
                            {conversations.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="vocabulary" className="flex-1 flex flex-col min-h-0 m-0 p-0">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-medium text-muted-foreground">
                          {selectedConversationId
                            ? "This session"
                            : selectedGroupId === "__ungrouped__"
                              ? "Unclassified"
                              : selectedGroupId
                              ? "This workspace"
                              : "All items"}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button variant={vocabView === "items" ? "secondary" : "ghost"} size="sm" className="h-6 px-2 text-[11px]" onClick={() => setVocabView("items")}>Items</Button>
                          <Button variant={vocabView === "frequency" ? "secondary" : "ghost"} size="sm" className="h-6 px-2 text-[11px]" onClick={() => setVocabView("frequency")}>Top words</Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant={vocabFilter === "all" ? "secondary" : "ghost"} size="sm" className="h-6 px-2 text-[11px]" onClick={() => setVocabFilter("all")}>All {scopedVocabulary.length}</Button>
                          <Button variant={vocabFilter === "word" ? "secondary" : "ghost"} size="sm" className="h-6 px-2 text-[11px]" onClick={() => setVocabFilter("word")}>Words {wordCount}</Button>
                          <Button variant={vocabFilter === "idiom" ? "secondary" : "ghost"} size="sm" className="h-6 px-2 text-[11px]" onClick={() => setVocabFilter("idiom")}>Idioms {idiomCount}</Button>
                          <Button variant={vocabFilter === "slang" ? "secondary" : "ghost"} size="sm" className="h-6 px-2 text-[11px]" onClick={() => setVocabFilter("slang")}>Slang {slangCount}</Button>
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
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleExportCsv} title="Export vocabulary as CSV"><FileDown className="h-3.5 w-3.5" />CSV</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => void handleExportPdf()} disabled={isExportingPdf} title="Export vocabulary as PDF">
                          {isExportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}PDF
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setShowManualAdd(true); setManualWord("") }}><Plus className="h-3.5 w-3.5" />Add</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => void handleTranslateScoped()} disabled={isBatchTranslating} title="Translate all in current scope">
                          {isBatchTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                          Translate all
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-2 flex flex-col gap-1">
                        {isLoadingVocab ? (
                          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        ) : vocabView === "items" && filteredVocabulary.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                            <BookOpen className="h-8 w-8 opacity-30" />
                            <p className="text-xs text-center text-balance leading-relaxed">No items in this filter yet.</p>
                          </div>
                        ) : vocabView === "items" ? (
                          <>
                            {filteredVocabulary.map((item) => (
                              <VocabularyCard key={item.id} item={item} onDelete={handleDelete} onToggleMastered={handleToggleMastered} onTranslate={handleTranslate} isTranslating={translatingId === item.id} />
                            ))}
                            {masteredCount > 0 && <p className="text-center text-xs text-muted-foreground py-2">{masteredCount} of {scopedVocabulary.length} mastered</p>}
                          </>
                        ) : frequentWords.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                            <BookOpen className="h-8 w-8 opacity-30" />
                            <p className="text-xs text-center text-balance leading-relaxed">No frequent words in this scope yet.</p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {frequentWords.map((item) => (
                              <div key={item.word} className="flex items-center justify-between rounded-md border border-border px-2 py-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-medium truncate">{item.word}</span>
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">{item.count}</Badge>
                                </div>
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void handleAddFrequentWord(item.word)}>+ Add</Button>
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => handleExcludeTopWord(item.word)} title="Exclude from top words globally">
                                  <EyeOff className="h-3 w-3 mr-1" />
                                  Exclude
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
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
                        onRenameGroup={handleRenameGroup}
                        onDeleteGroup={handleDeleteGroup}
                        onArchiveGroup={handleArchiveGroup}
                        onRestoreGroup={handleRestoreGroup}
                        onSelectGroup={handleSelectGroup}
                        onMoveConversationToGroup={handleMoveConversationToGroup}
                        workspaceStats={workspaceStats}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        {/* Left panel (single mode) */}
        {!leftCollapsed && rightCollapsed && (
        <div className="flex flex-col min-w-0 border-r border-border p-4 gap-3 flex-1">
          {/* Controls */}
          <div className="flex flex-col gap-2 shrink-0 sticky top-0 z-20 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <RecordingControls
                isRecording={isRecording}
                isLoading={status === "loading_model" && !isRecording}
                isSaving={isSaving}
                isExtracting={isExtracting}
                duration={duration}
                audioSource={audioSource}
                onStart={() => setShowStartSourceDialog(true)}
                onStop={stop}
                onSave={handleSave}
                onNew={() => {
                  reset()
                  setCurrentConversationId(null)
                  setSelectedConversationId(null)
                  setIsEditingTranscript(false)
                  setShowManualAdd(false)
                  setManualWord("")
                  setIsCurrentTranscriptSaved(false)
                }}
                hasTranscript={transcript.length > 20}
                isSaved={isCurrentTranscriptSaved}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={collapseLeftPanel}
                title="Collapse transcription panel"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            {(isRecording || transcript) && (
              <div className="flex flex-wrap items-center gap-2">
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
                {recordedAudioBlob && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => void handleRefineTranscript()}
                      disabled={isRefining}
                    >
                      {isRefining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                      {isRefining ? "Refining..." : "Re-transcribe (HQ)"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-xs"
                      onClick={downloadRecording}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Audio
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => void handleAutoDiarize()}
                  disabled={isDiarizing}
                >
                  {isDiarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                  {isDiarizing ? "Labeling..." : "Auto label speakers"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => void handleTranslateRecent()}
                  disabled={isTranslatingRecent || !recentSnippet}
                >
                  {isTranslatingRecent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                  Translate recent
                </Button>
              </div>
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
          {recentSnippet && (
            <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-[11px] text-muted-foreground mb-1">{isRecording ? "Live" : "Recent"}</p>
              <p className="text-sm text-foreground">{recentSnippet}</p>
              {recentSnippetTranslation && <p className="mt-1 text-sm font-medium text-primary">{recentSnippetTranslation}</p>}
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
        )}
        {leftCollapsed && (
          <div className="w-10 border-r border-border flex items-start justify-center pt-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={expandLeftPanel}
              title="Expand transcription panel"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Right panel (single mode): Vocabulary + History */}
        {!rightCollapsed && leftCollapsed && (
        <div className="flex flex-col border-l border-border min-w-0 flex-1">
          <Tabs defaultValue="vocabulary" className="flex flex-col flex-1 min-h-0">
            <div className="border-b border-border px-4 pt-2 shrink-0">
              <div className="mb-2 flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={collapseRightPanel}
                  title="Collapse right panel"
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </Button>
                {leftCollapsed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={expandLeftPanel}
                    title="Expand left panel"
                  >
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <TabsList className="w-full">
                <TabsTrigger value="vocabulary" className="flex-1 gap-1.5 text-xs">
                  <BookOpen className="h-3.5 w-3.5" />
                  Vocabulary
                  {scopedVocabulary.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-4 px-1 min-w-4">
                      {scopedVocabulary.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 gap-1.5 text-xs">
                  <History className="h-3.5 w-3.5" />
                  Workspace
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
                    {selectedConversationId
                      ? "This session"
                      : selectedGroupId === "__ungrouped__"
                        ? "Unclassified"
                        : selectedGroupId
                        ? "This workspace"
                        : "All items"}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={vocabView === "items" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setVocabView("items")}
                    >
                      Items
                    </Button>
                    <Button
                      variant={vocabView === "frequency" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setVocabView("frequency")}
                    >
                      Top words
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={vocabFilter === "all" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setVocabFilter("all")}
                    >
                      All {scopedVocabulary.length}
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
                    <Button
                      variant={vocabFilter === "slang" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setVocabFilter("slang")}
                    >
                      Slang {slangCount}
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
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={handleExportCsv}
                    title="Export vocabulary as CSV"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => void handleExportPdf()}
                    disabled={isExportingPdf}
                    title="Export vocabulary as PDF"
                  >
                    {isExportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                    PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => { setShowManualAdd(true); setManualWord("") }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => void handleTranslateScoped()}
                    disabled={isBatchTranslating}
                    title="Translate all in current scope"
                  >
                    {isBatchTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                    Translate all
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 flex flex-col gap-1">
                  {isLoadingVocab ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : vocabView === "items" && filteredVocabulary.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                      <BookOpen className="h-8 w-8 opacity-30" />
                      <p className="text-xs text-center text-balance leading-relaxed">
                        No items in this filter yet.
                      </p>
                    </div>
                  ) : vocabView === "items" ? (
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
                          {masteredCount} of {scopedVocabulary.length} mastered
                        </p>
                      )}
                    </>
                  ) : frequentWords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                      <BookOpen className="h-8 w-8 opacity-30" />
                      <p className="text-xs text-center text-balance leading-relaxed">
                        No frequent words in this scope yet.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {frequentWords.map((item) => (
                        <div key={item.word} className="flex items-center justify-between rounded-md border border-border px-2 py-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate">{item.word}</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">{item.count}</Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => void handleAddFrequentWord(item.word)}
                          >
                            + Add
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            onClick={() => handleExcludeTopWord(item.word)}
                            title="Exclude from top words globally"
                          >
                            <EyeOff className="h-3 w-3 mr-1" />
                            Exclude
                          </Button>
                        </div>
                      ))}
                    </div>
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
                  onRenameGroup={handleRenameGroup}
                  onDeleteGroup={handleDeleteGroup}
                  onArchiveGroup={handleArchiveGroup}
                  onRestoreGroup={handleRestoreGroup}
                  onSelectGroup={handleSelectGroup}
                  onMoveConversationToGroup={handleMoveConversationToGroup}
                  workspaceStats={workspaceStats}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        )}
        {rightCollapsed && (
          <div className="w-10 border-l border-border flex items-start justify-center pt-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={expandRightPanel}
              title="Expand workspace panel"
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          </div>
        )}
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

      <Dialog open={showStartSourceDialog} onOpenChange={setShowStartSourceDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose audio source</DialogTitle>
            <DialogDescription>
              Select what to transcribe before starting.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            <div className="mb-1">
              <p className="text-xs text-muted-foreground mb-1">View mode on start</p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={startViewMode === "compact" ? "secondary" : "outline"}
                  onClick={() => setStartViewMode("compact")}
                >
                  Compact
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={startViewMode === "full" ? "secondary" : "outline"}
                  onClick={() => setStartViewMode("full")}
                >
                  Full
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2 h-10"
              onClick={() => void handleStartWithSource("system")}
            >
              <Monitor className="h-4 w-4" />
              Tab / System audio
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2 h-10"
              onClick={() => void handleStartWithSource("microphone")}
            >
              <Mic className="h-4 w-4" />
              Microphone
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster position="bottom-right" richColors />
    </div>
  )
}

function normalizeVocabType(type: VocabularyItem["type"]): VocabularyItem["type"] {
  if (type === "word" || type === "idiom" || type === "slang") return type
  return "idiom"
}

function extractRecentTail(text: string, sentenceCount: number) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean)
  if (sentences.length === 0) return normalized
  return sentences.slice(-sentenceCount).join(" ").trim()
}
