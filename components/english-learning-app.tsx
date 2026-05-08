"use client"

import { useState, useCallback, useEffect, useMemo, useRef, type ChangeEvent } from "react"
import { AudioInputSource, useTranscription } from "@/hooks/use-transcription"
import { useIsMobile } from "@/hooks/use-mobile"
import { TranscriptionColumn } from "@/components/transcription-column"
import { LibraryColumn } from "@/components/library-column"
import { ConfigDialog } from "@/components/config-dialog"
import { VocabularyItem, Conversation, ExtractedItem, ConversationGroup } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Toaster } from "@/components/ui/sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { jsPDF } from "jspdf"
import {
  BookOpen,
  History,
  GraduationCap,
  Loader2,
  AlertCircle,
  Settings2,
  Database,
  HardDrive,
  Monitor,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Pin,
  PinOff,
  Minimize2,
  Maximize2,
  Lock,
  MoreHorizontal,
  Moon,
  Sun,
  MessageCircle,
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { getStorageConfig, saveStorageConfig, StorageConfig, localAsrModelShortLabel } from "@/lib/storage-config"
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
  const [isTranslatingAllText, setIsTranslatingAllText] = useState(false)
  const [recentSnippet, setRecentSnippet] = useState("")
  const [recentSnippetTranslation, setRecentSnippetTranslation] = useState("")
  const [fullTranscriptTranslation, setFullTranscriptTranslation] = useState("")
  const [isFullTranscriptExpanded, setIsFullTranscriptExpanded] = useState(true)
  const [speakerPreview, setSpeakerPreview] = useState("")
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
  const transcriptFileInputRef = useRef<HTMLInputElement>(null)
  const [showPasteTranscriptDialog, setShowPasteTranscriptDialog] = useState(false)
  const [pasteTranscriptDraft, setPasteTranscriptDraft] = useState("")

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
  const isMobile = useIsMobile()
  const [mobileMainTab, setMobileMainTab] = useState<"capture" | "words" | "sessions" | "tutor">("capture")
  const { resolvedTheme, setTheme } = useTheme()

  // Transcription hook
  const { status, loadingProgress, loadingFile, transcript, interimTranscript, isRecording, duration, audioSource, debugInfo, utterances, recordedAudioBlob, isRefining, refineProgress, start, stop, reset, refineTranscript, downloadRecording, setTranscript } =
    useTranscription({
      onError: (msg) => toast.error(msg),
      localAsrModel: storageConfig.localAsrModel,
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
        body: JSON.stringify({ transcript: input, provider: storageConfig.translationProviderRecent }),
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
  }, [storageConfig.translationProviderRecent])

  // Save session + auto-extract vocabulary, or re-run extract on the same saved session
  const handleSave = useCallback(async () => {
    if (!transcript.trim()) return

    const reuseConversationId = currentConversationId
    const isReextract = isCurrentTranscriptSaved && Boolean(reuseConversationId)

    if (isReextract && reuseConversationId) {
      setIsExtracting(true)
      try {
        if (isLocal) {
          const updated = localUpdateConversationTranscript(reuseConversationId, transcript)
          if (!updated) throw new Error("Failed to update session")
          setConversations(localGetConversations())
        } else {
          const patchRes = await fetch(`/api/conversations/${reuseConversationId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript }),
          })
          if (!patchRes.ok) throw new Error("Failed to update session")
          await fetchConversations()
        }

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
        const data: { items?: ExtractedItem[] } = await extractRes.json()
        const items: ExtractedItem[] = Array.isArray(data?.items) ? data.items : []

        const existingNorm = new Set(
          vocabulary
            .filter((v) => v.conversation_id === reuseConversationId)
            .map((v) => v.word.trim().toLowerCase())
        )
        const freshItems = items.filter((item) => !existingNorm.has(item.word.trim().toLowerCase()))

        if (freshItems.length === 0) {
          toast.info(
            items.length === 0
              ? "No vocabulary items found in this transcript."
              : "All extracted items are already in this session. Try editing the transcript, then extract again."
          )
        } else {
          let saved: VocabularyItem[]
          if (isLocal) {
            saved = freshItems.map((item) =>
              localCreateVocabularyItem({
                conversation_id: reuseConversationId,
                word: item.word,
                type: normalizeVocabType(item.type),
                definition: item.definition,
                example_sentence: item.example_sentence,
                context: item.context,
                korean_translation: null,
              })
            )
          } else {
            const savePromises = freshItems.map((item) =>
              fetch("/api/vocabulary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  conversation_id: reuseConversationId,
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
          toast.success(`Added ${saved.length} new vocabulary item${saved.length !== 1 ? "s" : ""}!`)
        }
        setIsCurrentTranscriptSaved(true)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        toast.error(msg)
      } finally {
        setIsExtracting(false)
      }
      return
    }

    if (isCurrentTranscriptSaved && !reuseConversationId) {
      toast.error("No session is linked to this transcript. Use New, then Save & Extract.")
      return
    }

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
      const data: { items?: ExtractedItem[] } = await extractRes.json()
      const items: ExtractedItem[] = Array.isArray(data?.items) ? data.items : []

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
  }, [transcript, duration, isLocal, isCurrentTranscriptSaved, currentConversationId, vocabulary])

  const handleExtractOnly = useCallback(async () => {
    const text = transcript.trim()
    if (text.length < 10) {
      toast.info("Enter at least 10 characters to extract vocabulary.")
      return
    }
    setIsExtracting(true)
    try {
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      })
      if (!extractRes.ok) {
        let message = "Extraction failed"
        try {
          const body = await extractRes.json()
          if (typeof body?.error === "string" && body.error) message = body.error
        } catch {}
        throw new Error(message)
      }
      const data: { items?: ExtractedItem[] } = await extractRes.json()
      const items: ExtractedItem[] = Array.isArray(data?.items) ? data.items : []
      const targetId = currentConversationId
      const existingNorm = new Set(
        vocabulary.filter((v) => v.conversation_id === targetId).map((v) => v.word.trim().toLowerCase())
      )
      const freshItems = items.filter((item) => !existingNorm.has(item.word.trim().toLowerCase()))
      if (freshItems.length === 0) {
        toast.info(
          items.length === 0
            ? "No vocabulary items found in this transcript."
            : targetId
              ? "All extracted items are already linked to this session. Use Extract again after saving, or edit the transcript."
              : "All extracted items are already in your list for unsaved items. Save a session or edit the transcript."
        )
        return
      }
      let saved: VocabularyItem[]
      if (isLocal) {
        saved = freshItems.map((item) =>
          localCreateVocabularyItem({
            conversation_id: currentConversationId,
            word: item.word,
            type: normalizeVocabType(item.type),
            definition: item.definition,
            example_sentence: item.example_sentence,
            context: item.context,
            korean_translation: null,
          })
        )
      } else {
        const savePromises = freshItems.map((item) =>
          fetch("/api/vocabulary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversation_id: currentConversationId,
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
      toast.success(`Added ${saved.length} new vocabulary item${saved.length !== 1 ? "s" : ""}!`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsExtracting(false)
    }
  }, [transcript, currentConversationId, isLocal, vocabulary])

  const applyTranscriptImport = useCallback(
    (raw: string) => {
      const text = raw.replace(/\r\n/g, "\n").trim()
      if (!text) {
        toast.info("No text to import.")
        return
      }
      if (transcript.trim() && typeof window !== "undefined") {
        if (!window.confirm("Replace the current transcript with imported text?")) return
      }
      setTranscript(text)
      setIsCurrentTranscriptSaved(false)
      setCurrentConversationId(null)
      setSelectedConversationId(null)
      setDiarizedItems([])
      setSpeakerPreview("")
      setIsEditingTranscript(false)
      setShowManualAdd(false)
      setManualWord("")
      toast.success("Transcript loaded")
    },
    [transcript, setTranscript]
  )

  const handleTranscriptFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file) return
      try {
        const text = await file.text()
        applyTranscriptImport(text)
      } catch {
        toast.error("Could not read that file")
      }
    },
    [applyTranscriptImport]
  )

  const handleApplyPastedTranscript = useCallback(() => {
    applyTranscriptImport(pasteTranscriptDraft)
    setShowPasteTranscriptDialog(false)
    setPasteTranscriptDraft("")
  }, [applyTranscriptImport, pasteTranscriptDraft])

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
          provider: storageConfig.translationProviderAll,
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
  }, [isLocal, storageConfig.translationProviderAll])

  const handleTranslateRecent = useCallback(async () => {
    const input = recentSnippet || extractRecentTail(`${transcript} ${interimTranscript}`.trim(), 1)
    if (!input) return
    setIsTranslatingRecent(true)
    try {
      const res = await fetch("/api/translate-recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: input, provider: storageConfig.translationProviderRecent, scope: "recent" }),
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
  }, [recentSnippet, transcript, interimTranscript, storageConfig.translationProviderRecent])

  const handleTranslateAllTranscript = useCallback(async () => {
    const input = `${transcript} ${interimTranscript}`.trim()
    if (!input) return
    setIsTranslatingAllText(true)
    try {
      const res = await fetch("/api/translate-recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: input, provider: storageConfig.translationProviderAll, scope: "all" }),
      })
      if (!res.ok) throw new Error("Failed to translate transcript")
      const data = await res.json()
      const korean = typeof data?.korean_translation === "string" ? data.korean_translation : ""
      setFullTranscriptTranslation(korean)
      toast.success("Translated full transcript")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsTranslatingAllText(false)
    }
  }, [transcript, interimTranscript, storageConfig.translationProviderAll])

  useEffect(() => {
    const combined = `${transcript} ${interimTranscript}`.trim()
    if (!combined) {
      setRecentSnippet("")
      setRecentSnippetTranslation("")
      setFullTranscriptTranslation("")
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
    const input = `${transcript} ${interimTranscript}`.trim()
    if (!input) {
      toast.info("No transcript text to label yet")
      return
    }
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
      if (items.length > 0) {
        const preview = items
          .slice(0, 6)
          .map((item: { text: string; speaker: "A" | "B" }) => `${item.speaker}: ${item.text}`)
          .join("\n")
        setSpeakerPreview(preview)
        toast.success("Speaker labels updated")
      } else {
        setSpeakerPreview("")
        toast.info("No diarization result")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsDiarizing(false)
    }
  }, [transcript, interimTranscript])

  const handleApplySpeakerLabels = useCallback(() => {
    if (diarizedItems.length === 0) return
    const labeled = diarizedItems
      .map((item: { text: string; speaker: "A" | "B" }) => `${item.speaker}: ${item.text}`)
      .join("\n")
    setTranscript(labeled)
    setSpeakerPreview("")
    toast.success("Speaker labels applied to transcript")
  }, [diarizedItems, setTranscript])

  const handleRefineTranscript = useCallback(async () => {
    try {
      const refined = await refineTranscript()
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
      toast.info("Folders are saved in this browser only.")
    }
    const created = localCreateConversationGroup(name, [])
    setConversationGroups((prev) => [created, ...prev])
    setSelectedGroupId(created.id)
    toast.success("Folder created")
  }, [isLocal])

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    localDeleteConversationGroup(groupId)
    setConversationGroups((prev) => prev.filter((g) => g.id !== groupId))
    if (selectedGroupId === groupId) setSelectedGroupId(null)
    toast.success("Folder deleted")
  }, [selectedGroupId])

  const handleArchiveGroup = useCallback(async (groupId: string) => {
    const updated = localArchiveConversationGroup(groupId)
    if (!updated) return
    setConversationGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
    if (selectedGroupId === groupId) setSelectedGroupId(null)
    toast.success("Folder archived")
  }, [selectedGroupId])

  const handleRestoreGroup = useCallback(async (groupId: string) => {
    const updated = localRestoreConversationGroup(groupId)
    if (!updated) return
    setConversationGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
    toast.success("Folder restored")
  }, [])

  const handleRenameGroup = useCallback(async (groupId: string, nextName: string) => {
    const name = nextName.trim()
    if (!name) return
    const updated = localUpdateConversationGroupName(groupId, name)
    if (!updated) {
      toast.error("Failed to rename folder")
      return
    }
    setConversationGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
    toast.success("Folder name updated")
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
    toast.success(groupId ? "Moved to folder" : "Moved to inbox")
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
          provider: storageConfig.translationProviderAll,
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
  }, [scopedVocabulary, isLocal, storageConfig.translationProviderAll])

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
    return <div className="h-dvh max-h-dvh bg-background" />
  }

  if (!isUnlocked) {
    return (
      <div className="h-dvh max-h-dvh bg-background flex items-center justify-center p-4">
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

  const renderTranscription = (panelClassName?: string) => (
    <TranscriptionColumn
      className={cn(panelClassName)}
      compactToolbar={isMobile}
      hasBottomNav={isMobile}
      showCollapseButton={!isMobile}
      onCollapseLeft={collapseLeftPanel}
      isRecording={isRecording}
      status={status}
      isSaving={isSaving}
      isExtracting={isExtracting}
      duration={duration}
      audioSource={audioSource}
      onStart={() => setShowStartSourceDialog(true)}
      onStop={stop}
      onSave={handleSave}
      onExtractOnly={() => void handleExtractOnly()}
      onPickTranscriptFile={() => transcriptFileInputRef.current?.click()}
      onPasteTranscript={() => setShowPasteTranscriptDialog(true)}
      onNew={() => {
        reset()
        setCurrentConversationId(null)
        setSelectedConversationId(null)
        setIsEditingTranscript(false)
        setShowManualAdd(false)
        setManualWord("")
        setIsCurrentTranscriptSaved(false)
      }}
      hasTranscript={transcript.trim().length >= 10}
      isCurrentTranscriptSaved={isCurrentTranscriptSaved}
      transcript={transcript}
      interimTranscript={interimTranscript}
      vocabulary={vocabulary}
      onTranscriptChange={setTranscript}
      onTextSelect={handleTextSelect}
      isEditingTranscript={isEditingTranscript}
      onToggleEditTranscript={() => void handleToggleEditTranscript()}
      recordedAudioBlob={recordedAudioBlob}
      onRefineTranscript={() => void handleRefineTranscript()}
      isRefining={isRefining}
      refineProgress={refineProgress}
      onDownloadRecording={downloadRecording}
      onAutoDiarize={() => void handleAutoDiarize()}
      isDiarizing={isDiarizing}
      onTranslateRecent={() => void handleTranslateRecent()}
      isTranslatingRecent={isTranslatingRecent}
      recentSnippet={recentSnippet}
      onTranslateAllTranscript={() => void handleTranslateAllTranscript()}
      isTranslatingAllText={isTranslatingAllText}
      recentSnippetTranslation={recentSnippetTranslation}
      speakerPreview={speakerPreview}
      onApplySpeakerLabels={handleApplySpeakerLabels}
      loadingFile={loadingFile}
      loadingProgress={loadingProgress}
      fullTranscriptTranslation={fullTranscriptTranslation}
      isFullTranscriptExpanded={isFullTranscriptExpanded}
      onToggleFullTranslationExpanded={() => setIsFullTranscriptExpanded((p) => !p)}
      debugInfo={debugInfo}
      showManualAdd={showManualAdd}
      manualWord={manualWord}
      onManualAdd={handleManualAdd}
      onTranslateSelectedText={handleTranslateSelectedText}
      translatedSelectedText={translatedSelectedText}
      isTranslatingSelectedText={isTranslatingSelectedText}
      onCancelManualAdd={() => {
        setShowManualAdd(false)
        setManualWord("")
        setTranslatedSelectedText(null)
      }}
      isSubmittingManual={isSubmittingManual}
    />
  )

  const renderLibrary = (soloMobile: boolean, mobileActiveTab?: "words" | "sessions" | "tutor") => (
    <LibraryColumn
      variant={soloMobile ? "solo" : "split"}
      onCollapseRight={soloMobile ? undefined : collapseRightPanel}
      leftCollapsed={leftCollapsed}
      onExpandLeft={soloMobile ? undefined : expandLeftPanel}
      activeTab={
        mobileActiveTab === "words" ? "vocabulary"
        : mobileActiveTab === "sessions" ? "history"
        : mobileActiveTab === "tutor" ? "tutor"
        : undefined
      }
      hideTabs={soloMobile}
      scopedVocabulary={scopedVocabulary}
      conversations={conversations}
      conversationGroups={conversationGroups}
      selectedGroupId={selectedGroupId}
      selectedConversationId={selectedConversationId}
      onSelectConversation={handleSelectConversation}
      onRenameConversation={handleRenameConversation}
      onDeleteConversation={handleDeleteConversation}
      onCreateGroup={handleCreateGroup}
      onRenameGroup={handleRenameGroup}
      onDeleteGroup={handleDeleteGroup}
      onArchiveGroup={handleArchiveGroup}
      onRestoreGroup={handleRestoreGroup}
      onSelectGroup={handleSelectGroup}
      onMoveConversationToGroup={handleMoveConversationToGroup}
      workspaceStats={workspaceStats}
      vocabView={vocabView}
      setVocabView={setVocabView}
      vocabFilter={vocabFilter}
      setVocabFilter={setVocabFilter}
      wordCount={wordCount}
      idiomCount={idiomCount}
      slangCount={slangCount}
      filteredVocabulary={filteredVocabulary}
      frequentWords={frequentWords}
      isLoadingVocab={isLoadingVocab}
      isBatchTranslating={isBatchTranslating}
      isExportingPdf={isExportingPdf}
      masteredCount={masteredCount}
      onShowAllVocabulary={() => {
        setSelectedConversationId(null)
        void fetchVocabulary()
      }}
      onExportCsv={handleExportCsv}
      onExportPdf={handleExportPdf}
      onShowManualAdd={() => {
        setShowManualAdd(true)
        setManualWord("")
      }}
      onTranslateScoped={() => void handleTranslateScoped()}
      onDeleteVocab={handleDelete}
      onToggleMastered={handleToggleMastered}
      onTranslate={handleTranslate}
      translatingId={translatingId}
      onAddFrequentWord={handleAddFrequentWord}
      onExcludeTopWord={handleExcludeTopWord}
      tutorTranscriptContext={`${transcript} ${interimTranscript}`.trim().slice(0, 12000)}
    />
  )

  return (
    <div
      className={cn(
        "flex flex-col h-dvh max-h-dvh min-h-0 bg-background text-foreground transition-[padding] duration-200",
        isRecording && audioSource === "system" ? "pt-14" : "pt-0"
      )}
    >
      {/* Header */}
      <header className={cn(
        "border-border bg-card/90 backdrop-blur-md supports-backdrop-filter:bg-card/80",
        "flex shrink-0 items-center justify-between gap-2 border-b min-w-0",
        "px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5 sm:py-2.5 sm:pt-2.5"
      )}>
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-primary/10 rounded-lg p-1.5 shrink-0">
            <GraduationCap className="text-primary h-4 w-4" />
          </div>
          <h1 className="text-foreground font-bold text-sm sm:text-base leading-none">SurviveEnglish</h1>
        </div>

        {/* Center: recording status (mobile) or model status (desktop) */}
        <div className="flex flex-1 items-center justify-center gap-2 min-w-0 px-2">
          {/* Mobile: recording indicator */}
          {isMobile && isRecording && (
            <button
              onClick={() => setMobileMainTab("capture")}
              className="flex items-center gap-1.5 rounded-full bg-recording/10 px-2.5 py-1 text-xs font-medium text-recording"
            >
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-recording" />
              <span className="font-mono tabular-nums">
                {String(Math.floor(duration / 60)).padStart(2, "0")}:{String(duration % 60).padStart(2, "0")}
              </span>
            </button>
          )}
          {/* Desktop: model loading / error */}
          {!isMobile && status === "loading_model" && (
            <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground min-w-0 max-w-xs">
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              <span className="truncate">
                {loadingProgress > 0
                  ? `Loading ${localAsrModelShortLabel(storageConfig.localAsrModel)} · ${loadingProgress}%`
                  : `Downloading ${localAsrModelShortLabel(storageConfig.localAsrModel)}…`}
              </span>
            </div>
          )}
          {!isMobile && status === "error" && (
            <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive px-3 py-1 text-xs">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>Web Speech fallback</span>
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Vocab stats pill (desktop) */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground mr-0.5">
            <BookOpen className="h-3 w-3 text-primary/70" />
            <span className="tabular-nums font-medium text-foreground">{vocabulary.length}</span>
            <span>words</span>
            {masteredCount > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="tabular-nums text-accent-foreground font-medium">{masteredCount}</span>
                <span>mastered</span>
              </>
            )}
          </div>

          {/* Storage badge (desktop) */}
          <Badge
            variant="outline"
            className={cn(
              "hidden gap-1 text-xs sm:flex h-6 cursor-default select-none",
              isLocal
                ? "text-muted-foreground border-border/60 bg-transparent"
                : "text-primary border-primary/30 bg-primary/5"
            )}
          >
            {isLocal ? <HardDrive className="h-3 w-3" /> : <Database className="h-3 w-3" />}
            {isLocal ? "Local" : "Cloud"}
          </Badge>

          {/* Mobile menu */}
          {isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden" aria-label="App menu">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-muted-foreground font-normal text-xs">Quick info</DropdownMenuLabel>
                <DropdownMenuItem disabled className="text-xs">
                  <BookOpen className="mr-2 h-3.5 w-3.5" />
                  {vocabulary.length} words · {masteredCount} mastered
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="text-xs">
                  {isLocal ? <HardDrive className="mr-2 h-3.5 w-3.5" /> : <Database className="mr-2 h-3.5 w-3.5" />}
                  {isLocal ? "Local storage" : "Cloud (Supabase)"}
                </DropdownMenuItem>
                {status === "loading_model" && (
                  <DropdownMenuItem disabled className="text-xs">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    {loadingProgress > 0 ? `Whisper ${loadingProgress}%` : "Downloading model…"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                  {resolvedTheme === "dark" ? (
                    <Sun className="mr-2 h-3.5 w-3.5" />
                  ) : (
                    <Moon className="mr-2 h-3.5 w-3.5" />
                  )}
                  {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => setShowConfig(true)}>
                  <Settings2 className="mr-2 h-3.5 w-3.5" />
                  Settings & storage
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:flex h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setShowConfig(true)}
            title="Settings"
          >
            <Settings2 className="h-4 w-4" />
          </Button>

          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:flex h-8 w-8 text-muted-foreground hover:text-foreground relative overflow-hidden"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
          </Button>

          {/* Desktop controls */}
          {isDesktop && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => void handleToggleAlwaysOnTop()}
                title={alwaysOnTop ? "Unpin window" : "Always on top"}
              >
                {alwaysOnTop ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => void handleToggleDesktopViewMode()}
                title={desktopViewMode === "compact" ? "Full view" : "Compact view"}
              >
                {desktopViewMode === "compact" ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isMobile ? (
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Recording indicator — shown when recording on non-capture tab */}
            {isRecording && mobileMainTab !== "capture" && (
              <button
                onClick={() => setMobileMainTab("capture")}
                className="flex w-full shrink-0 items-center gap-2 border-b border-recording/20 bg-recording/10 px-4 py-2"
                aria-label="Recording in progress – tap to view transcript"
              >
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-recording" />
                <span className="font-mono text-sm font-medium tabular-nums text-recording">
                  {String(Math.floor(duration / 60)).padStart(2, "0")}:{String(duration % 60).padStart(2, "0")}
                </span>
                <span className="text-sm text-recording">· Recording</span>
                <span className="ml-auto text-xs text-recording/60">View →</span>
              </button>
            )}

            {/* Content panels — always mounted, CSS show/hide preserves state */}
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{ display: mobileMainTab === "capture" ? "flex" : "none" }}
            >
              {renderTranscription("flex-1 min-h-0")}
            </div>
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{ display: mobileMainTab !== "capture" ? "flex" : "none" }}
            >
              {renderLibrary(true, mobileMainTab !== "capture" ? mobileMainTab : "words")}
            </div>

            {/* Bottom navigation */}
            <nav
              className="shrink-0 border-t border-border bg-card/95 backdrop-blur-md"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="grid h-14 grid-cols-4">
                {(
                  [
                    { value: "capture" as const, icon: Mic, label: "Capture" },
                    { value: "words" as const, icon: BookOpen, label: "Words" },
                    { value: "sessions" as const, icon: History, label: "Sessions" },
                    { value: "tutor" as const, icon: MessageCircle, label: "Tutor" },
                  ] as const
                ).map(({ value, icon: Icon, label }) => {
                  const isActive = mobileMainTab === value
                  const badgeCount =
                    value === "words" && !isActive && vocabulary.length > 0
                      ? vocabulary.length
                      : value === "sessions" && !isActive && conversations.length > 0
                        ? conversations.length
                        : null
                  return (
                    <button
                      key={value}
                      onClick={() => setMobileMainTab(value)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex flex-col items-center justify-center gap-0.5 transition-colors duration-150",
                        isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
                      )}
                    >
                      <div className="relative">
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            value === "capture" && isRecording && "text-recording"
                          )}
                        />
                        {/* Recording pulse indicator on Capture nav item */}
                        {value === "capture" && isRecording && (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full border-[1.5px] border-card bg-recording" />
                        )}
                        {/* Count badge */}
                        {badgeCount !== null && (
                          <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-center font-mono text-[9px] font-bold leading-4 text-primary-foreground">
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-medium leading-none",
                          value === "capture" && isRecording && "text-recording"
                        )}
                      >
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </nav>
          </div>
        ) : (
          <>
            {!leftCollapsed && !rightCollapsed && (
              <ResizablePanelGroup direction="horizontal" className="flex-1">
                <ResizablePanel
                  defaultSize={leftPanelWidthPct}
                  minSize={25}
                  maxSize={75}
                  onResize={(size) => setLeftPanelWidthPct(size)}
                  className="min-w-0"
                >
                  {renderTranscription("h-full min-h-0 border-r border-border")}
                </ResizablePanel>
                <ResizableHandle withHandle className="bg-border/80 hover:bg-primary/40 data-dragging:bg-primary/50" />
                <ResizablePanel defaultSize={100 - leftPanelWidthPct} minSize={25} maxSize={75} className="min-w-0">
                  {renderLibrary(false)}
                </ResizablePanel>
              </ResizablePanelGroup>
            )}

            {!leftCollapsed && rightCollapsed && (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">{renderTranscription("h-full min-h-0 border-r border-border")}</div>
            )}

            {leftCollapsed && (
              <div className="border-border flex w-11 shrink-0 flex-col items-center border-r pt-3 sm:w-10">
                <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-7 sm:w-7" onClick={expandLeftPanel} title="Expand transcribe panel">
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              </div>
            )}

            {!rightCollapsed && leftCollapsed && (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">{renderLibrary(false, undefined)}</div>
            )}

            {rightCollapsed && !isMobile && (
              <div className="border-border flex w-11 shrink-0 flex-col items-center border-l pt-3 sm:w-10">
                <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-7 sm:w-7" onClick={expandRightPanel} title="Expand study panel">
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
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

      <input
        ref={transcriptFileInputRef}
        type="file"
        accept=".txt,text/plain,text/*"
        className="hidden"
        onChange={handleTranscriptFileSelected}
      />

      <Dialog
        open={showPasteTranscriptDialog}
        onOpenChange={(open) => {
          setShowPasteTranscriptDialog(open)
          if (!open) setPasteTranscriptDraft("")
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste transcript</DialogTitle>
            <DialogDescription>
              Paste English text (for example from subtitles or notes). Then use Extract words or Save & Extract.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="paste-transcript-body">Transcript</Label>
            <Textarea
              id="paste-transcript-body"
              value={pasteTranscriptDraft}
              onChange={(e) => setPasteTranscriptDraft(e.target.value)}
              rows={12}
              className="min-h-[200px] font-mono text-sm"
              spellCheck={false}
              placeholder="Paste English text here..."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowPasteTranscriptDialog(false)
                setPasteTranscriptDraft("")
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleApplyPastedTranscript()}>
              Use transcript
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Toaster position={isMobile ? "top-center" : "bottom-right"} richColors />
    </div>
  )
}

function normalizeVocabType(type: VocabularyItem["type"] | string): VocabularyItem["type"] {
  const normalized = String(type).trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (
    normalized === "word" ||
    normalized === "idiom" ||
    normalized === "slang" ||
    normalized === "phrasal_verb" ||
    normalized === "expression"
  ) {
    return normalized
  }
  if (normalized === "phrase" || normalized === "collocation") return "expression"
  return "word"
}

function extractRecentTail(text: string, sentenceCount: number) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean)
  if (sentences.length === 0) return normalized
  return sentences.slice(-sentenceCount).join(" ").trim()
}
