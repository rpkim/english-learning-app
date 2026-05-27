"use client"

import { useState, useCallback, useEffect, useMemo, useRef, type ChangeEvent } from "react"
import { AudioInputSource, useTranscription } from "@/hooks/use-transcription"
import { useIsMobile } from "@/hooks/use-mobile"
import { TranscriptionColumn } from "@/components/transcription-column"
import { LibraryColumn } from "@/components/library-column"
import { ConfigDialog } from "@/components/config-dialog"
import { TutorHistoryPanel } from "@/components/tutor-history-panel"
import { ConversationHistory } from "@/components/conversation-history"
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
  dbGetConversations,
  dbCreateConversation,
  dbUpdateConversation,
  dbDeleteConversation,
  dbGetConversationGroups,
  dbCreateConversationGroup,
  dbUpdateConversationGroup,
  dbDeleteConversationGroup,
  dbMoveConversationToGroup,
  dbGetVocabularyItems,
  dbGetVocabularyByConversation,
  dbCreateVocabularyItem,
  dbUpdateVocabularyItem,
  dbDeleteVocabularyItem,
  dbGetTutorSessions,
  dbSaveTutorSession,
  dbDeleteTutorSession,
} from "@/lib/db"
import { getSupabaseClient } from "@/lib/supabase-client"
import { LoginScreen } from "@/components/login-screen"
import type { User } from "@supabase/supabase-js"

export function EnglishLearningApp() {
  const UNLOCK_SESSION_KEY = "surviveenglish_app_unlocked"

  // Storage config
  const [storageConfig, setStorageConfig] = useState<StorageConfig>(() => getStorageConfig())
  const [showConfig, setShowConfig] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  // Transcription state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isCurrentTranscriptSaved, setIsCurrentTranscriptSaved] = useState(false)
  const [showStartSourceDialog, setShowStartSourceDialog] = useState(false)

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
  const [vocabSourceFilter, setVocabSourceFilter] = useState<"all" | "session" | "tutor" | "manual">("all")
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
  const [leftCollapsed, setLeftCollapsed] = useState(true)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [leftPanelWidthPct, setLeftPanelWidthPct] = useState(32)
  const [isDesktop, setIsDesktop] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const [desktopViewMode, setDesktopViewMode] = useState<"compact" | "full">("full")
  const isMobile = useIsMobile()
  const [mobileMainTab, setMobileMainTab] = useState<"capture" | "words" | "history" | "tutor">("tutor")
  const [captureSubTab, setCaptureSubTab] = useState<"record" | "sessions">("record")
  const [desktopCaptureSubTab, setDesktopCaptureSubTab] = useState<"record" | "captures">("record")
  const [desktopMainTab, setDesktopMainTab] = useState<"tutor" | "capture" | "words" | "history">("tutor")
  const [tutorSessions, setTutorSessions] = useState<import("@/lib/types").TutorSession[]>([])
  const { resolvedTheme, setTheme } = useTheme()

  // Transcription hook
  const { status, loadingProgress, loadingFile, transcript, interimTranscript, isRecording, duration, audioSource, debugInfo, utterances, recordedAudioBlob, isRefining, refineProgress, start, stop, reset, refineTranscript, downloadRecording, setTranscript } =
    useTranscription({
      onError: (msg) => toast.error(msg),
      localAsrModel: storageConfig.localAsrModel,
    })

  // Supabase auth — listen for session changes
  useEffect(() => {
    const sb = getSupabaseClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsAuthReady(true)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = useCallback(async () => {
    await getSupabaseClient().auth.signOut()
  }, [])

  // Load data from Supabase when user is authenticated
  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const [convs, groups, vocab, sessions] = await Promise.all([
          dbGetConversations(),
          dbGetConversationGroups(),
          dbGetVocabularyItems(),
          dbGetTutorSessions(),
        ])
        setConversations(convs)
        setConversationGroups(groups)
        setVocabulary(vocab)
        setTutorSessions(sessions)
      } catch (err) {
        console.error("Failed to load data:", err)
      }
    }
    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const rawAssignments = window.localStorage.getItem("speaker_assignments_by_conversation")
      const rawLabels = window.localStorage.getItem("speaker_labels_by_conversation")
      if (rawAssignments) setSpeakerAssignmentsByConversation(JSON.parse(rawAssignments))
      if (rawLabels) setSpeakerLabelsByConversation(JSON.parse(rawLabels))
    } catch {}
  }, [])

  const fetchVocabulary = useCallback(async (conversationId?: string) => {
    setIsLoadingVocab(true)
    try {
      const items = conversationId
        ? await dbGetVocabularyByConversation(conversationId)
        : await dbGetVocabularyItems()
      setVocabulary(items)
    } catch (err) { console.error(err) }
    finally { setIsLoadingVocab(false) }
  }, [])

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
        const updated = await dbUpdateConversation(reuseConversationId, { transcript })
        if (!updated) throw new Error("Failed to update session")
        setConversations((prev) => prev.map((c) => c.id === updated.id ? updated : c))

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
          const saved = await Promise.all(
            freshItems.map((item) =>
              dbCreateVocabularyItem({
                conversation_id: reuseConversationId,
                word: item.word,
                type: normalizeVocabType(item.type),
                source: "session",
                definition: item.definition,
                example_sentence: item.example_sentence,
                context: item.context,
                korean_translation: null,
                is_mastered: false,
              })
            )
          )
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

      // 1) Save conversation
      const savedConv = await dbCreateConversation(sessionTitle, transcript, duration)
      setConversations((prev) => [savedConv, ...prev])
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
        // 3) Save each extracted item
        const saved = await Promise.all(
          items.map((item) =>
            dbCreateVocabularyItem({
              conversation_id: savedConv.id,
              word: item.word,
              type: normalizeVocabType(item.type),
              source: "session",
              definition: item.definition,
              example_sentence: item.example_sentence,
              context: item.context,
              korean_translation: null,
              is_mastered: false,
            })
          )
        )
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
  }, [transcript, duration, isCurrentTranscriptSaved, currentConversationId, vocabulary])

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
      const saved = await Promise.all(
        freshItems.map((item) =>
          dbCreateVocabularyItem({
            conversation_id: currentConversationId,
            word: item.word,
            type: normalizeVocabType(item.type),
            source: "session",
            definition: item.definition,
            example_sentence: item.example_sentence,
            context: item.context,
            korean_translation: null,
            is_mastered: false,
          })
        )
      )
      setVocabulary((prev) => [...saved, ...prev])
      toast.success(`Added ${saved.length} new vocabulary item${saved.length !== 1 ? "s" : ""}!`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsExtracting(false)
    }
  }, [transcript, currentConversationId, vocabulary])

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
      const saved = await dbCreateVocabularyItem({
        conversation_id: currentConversationId,
        word: item.word,
        type: normalizeVocabType(item.type as VocabularyItem["type"]),
        source: "manual",
        definition: item.definition,
        example_sentence: null,
        context: item.context,
        korean_translation: null,
        is_mastered: false,
      })
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
    [currentConversationId]
  )

  // Delete vocabulary item
  const handleDelete = useCallback((id: string) => {
    void dbDeleteVocabularyItem(id)
    setVocabulary((prev) => prev.filter((v) => v.id !== id))
    toast.success("Item removed")
  }, [])

  // Toggle mastered
  const handleToggleMastered = useCallback((id: string, current: boolean) => {
    const next = { is_mastered: !current }
    setVocabulary((prev) => prev.map((v) => v.id === id ? { ...v, ...next } : v))
    void dbUpdateVocabularyItem(id, next)
  }, [])

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

      const updated = await dbUpdateVocabularyItem(item.id, { korean_translation: koreanTranslation })
      setVocabulary((prev) => prev.map((v) => (v.id === item.id ? updated : v)))
      toast.success(`Korean translation added for "${item.word}"`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setTranslatingId(null)
    }
  }, [storageConfig.translationProviderAll])

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
    void fetchVocabulary(conv.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTranscript, fetchVocabulary])

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
      const updated = await dbUpdateConversation(conv.id, { title })
      if (!updated) throw new Error("Failed to rename session")
      setConversations((prev) => prev.map((c) => (c.id === conv.id ? updated : c)))
      toast.success("Session title updated")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    }
  }, [])

  const handleDeleteConversation = useCallback((conv: Conversation) => {
    void dbDeleteConversation(conv.id)
    setConversations((prev) => prev.filter((c) => c.id !== conv.id))
    setVocabulary((prev) => prev.filter((v) => v.conversation_id !== conv.id))
    // Remove from groups
    setConversationGroups((prev) =>
      prev.map((g) => ({ ...g, conversation_ids: g.conversation_ids.filter((id) => id !== conv.id) }))
    )
    if (selectedConversationId === conv.id) {
      setSelectedConversationId(null)
      setCurrentConversationId(null)
      setTranscript("")
      void fetchVocabulary()
    }
    toast.success("Session deleted")
  }, [selectedConversationId, setTranscript, fetchVocabulary])

  const handleCreateGroup = useCallback(async (name: string) => {
    const created = await dbCreateConversationGroup(name)
    setConversationGroups((prev) => [created, ...prev])
    setSelectedGroupId(created.id)
    toast.success("Folder created")
  }, [])

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    await dbDeleteConversationGroup(groupId)
    setConversationGroups((prev) => prev.filter((g) => g.id !== groupId))
    if (selectedGroupId === groupId) setSelectedGroupId(null)
    toast.success("Folder deleted")
  }, [selectedGroupId])

  const handleArchiveGroup = useCallback(async (groupId: string) => {
    const updated = await dbUpdateConversationGroup(groupId, { archived_at: new Date().toISOString() })
    setConversationGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
    if (selectedGroupId === groupId) setSelectedGroupId(null)
    toast.success("Folder archived")
  }, [selectedGroupId])

  const handleRestoreGroup = useCallback(async (groupId: string) => {
    const updated = await dbUpdateConversationGroup(groupId, { archived_at: null })
    setConversationGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
    toast.success("Folder restored")
  }, [])

  const handleRenameGroup = useCallback(async (groupId: string, nextName: string) => {
    const name = nextName.trim()
    if (!name) return
    const updated = await dbUpdateConversationGroup(groupId, { name })
    setConversationGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
    toast.success("Folder name updated")
  }, [])

  const handleSelectGroup = useCallback((groupId: string | null) => {
    setSelectedGroupId(groupId)
    setSelectedConversationId(null)
    if (groupId) setCurrentConversationId(null)
    void fetchVocabulary()
  }, [fetchVocabulary])

  const handleMoveConversationToGroup = useCallback(async (conversationId: string, groupId: string | null) => {
    const updated = await dbMoveConversationToGroup(conversationId, groupId)
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
      const updated = await dbUpdateConversation(targetConversationId, { transcript })
      if (updated) {
        setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      }
      toast.success("Transcript updated")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    } finally {
      setIsEditingTranscript(false)
    }
  }, [isEditingTranscript, selectedConversationId, currentConversationId, transcript])

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

      for (const id of translatedIds) {
        void dbUpdateVocabularyItem(id, { korean_translation: translations[id] })
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
  }, [scopedVocabulary, storageConfig.translationProviderAll])

  const sourceScopedVocabulary = useMemo(() => {
    if (vocabSourceFilter === "all") return scopedVocabulary
    return scopedVocabulary.filter((v) => (v.source ?? "session") === vocabSourceFilter)
  }, [scopedVocabulary, vocabSourceFilter])

  const tutorVocabCount = useMemo(() => vocabulary.filter((v) => v.source === "tutor").length, [vocabulary])

  const masteredCount = sourceScopedVocabulary.filter((v) => v.is_mastered).length
  const wordCount = sourceScopedVocabulary.filter((v) => v.type === "word").length
  const idiomCount = sourceScopedVocabulary.filter((v) => v.type === "idiom").length
  const slangCount = sourceScopedVocabulary.filter((v) => v.type === "slang").length
  const filteredVocabulary = sourceScopedVocabulary.filter((item) => {
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
      const targetConversationId = selectedConversationId ?? null
      const saved = await dbCreateVocabularyItem({
        conversation_id: targetConversationId,
        word,
        type: "word",
        source: "session",
        definition: "Frequent word from selected sessions.",
        example_sentence: null,
        context: null,
        korean_translation: null,
        is_mastered: false,
      })
      setVocabulary((prev) => [saved, ...prev])
      toast.success(`"${word}" added to vocabulary`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
    }
  }, [vocabulary, selectedConversationId])

  const handleSaveTutorSession = useCallback(async (messages: import("@/lib/types").TutorChatMessage[]) => {
    const saved = await dbSaveTutorSession(messages)
    setTutorSessions((prev) => [saved, ...prev])
  }, [])

  const handleDeleteTutorSession = useCallback((id: string) => {
    void dbDeleteTutorSession(id)
    setTutorSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleAddVocabularyFromTutor = useCallback(
    async (payload: {
      word: string
      type: VocabularyItem["type"]
      definition?: string
      example_sentence?: string
      korean_translation?: string
      context?: string
    }) => {
      const already = vocabulary.some((v) => v.word.toLowerCase() === payload.word.toLowerCase())
      if (already) {
        toast.info(`"${payload.word}" is already in vocabulary`)
        return
      }
      try {
        const saved = await dbCreateVocabularyItem({
          conversation_id: null,
          word: payload.word,
          type: payload.type,
          source: "tutor",
          definition: payload.definition ?? null,
          example_sentence: payload.example_sentence ?? null,
          context: payload.context ?? null,
          korean_translation: payload.korean_translation ?? null,
          is_mastered: false,
        })
        setVocabulary((prev) => [saved, ...prev])
        toast.success(`"${saved.word}" added to vocabulary`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        toast.error(msg)
      }
    },
    [vocabulary]
  )

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
    setDesktopViewMode("full")
    setRightCollapsed(false)
    setLeftCollapsed(false)
    setLeftPanelWidthPct(58)
    if (typeof window !== "undefined") {
      await (window as Window & { desktop?: { setViewMode?: (mode: "compact" | "full") => Promise<boolean> } }).desktop?.setViewMode?.("full")
    }
    await start(source)
  }, [start])

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

  if (!user) {
    return <LoginScreen />
  }

  const renderDesktopCapturePanel = (panelClassName?: string) => (
    <div className={cn("flex min-h-0 flex-col overflow-hidden", panelClassName)}>
      {/* Sub-tab bar */}
      <div className="flex shrink-0 items-center gap-0 border-b border-border bg-card px-3">
        {(["record", "captures"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setDesktopCaptureSubTab(tab)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
              desktopCaptureSubTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "record" ? (
              <>
                {isRecording && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-recording" />}
                Record
              </>
            ) : (
              <>
                Sessions
                {conversations.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0 text-[10px] tabular-nums">{conversations.length}</span>
                )}
              </>
            )}
          </button>
        ))}
        {/* Collapse button */}
        <button
          onClick={collapseLeftPanel}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          title="Collapse"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Record sub-tab */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ display: desktopCaptureSubTab === "record" ? "flex" : "none" }}>
        {renderTranscriptionInner()}
      </div>

      {/* Captures sub-tab */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ display: desktopCaptureSubTab === "captures" ? "flex" : "none" }}>
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
    </div>
  )

  const renderTranscriptionInner = () => (
    <TranscriptionColumn
      className="h-full min-h-0 flex-1"
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

  // Mobile still uses a plain wrapper (sub-tabs handled separately in mobile layout)
  const renderTranscription = (panelClassName?: string) => (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", panelClassName)}>
      {renderTranscriptionInner()}
    </div>
  )

  const renderLibrary = (soloMobile: boolean, mobileActiveTab?: "vocabulary" | "tutor" | "tutor-history") => (
    <LibraryColumn
      variant={soloMobile ? "solo" : "split"}
      onCollapseRight={soloMobile ? undefined : collapseRightPanel}
      leftCollapsed={leftCollapsed}
      onExpandLeft={soloMobile ? undefined : expandLeftPanel}
      activeTab={mobileActiveTab}
      hideTabs={soloMobile}
      scopedVocabulary={sourceScopedVocabulary}
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
      vocabSourceFilter={vocabSourceFilter}
      setVocabSourceFilter={(f) => {
        setVocabSourceFilter(f)
        if (f !== "all") {
          setSelectedConversationId(null)
          setSelectedGroupId(null)
        }
      }}
      tutorVocabCount={tutorVocabCount}
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
        setSelectedGroupId(null)
        setVocabSourceFilter("all")
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
      onAddVocabularyFromTutor={handleAddVocabularyFromTutor}
      onSaveTutorSession={handleSaveTutorSession}
      tutorSessions={tutorSessions}
      onDeleteTutorSession={handleDeleteTutorSession}
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

          {/* User + logout (desktop) */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="hidden sm:flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  {user.user_metadata?.avatar_url
                    ? <img src={user.user_metadata.avatar_url as string} alt="" className="h-4 w-4 rounded-full" />
                    : <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">{(user.email ?? "U")[0].toUpperCase()}</div>}
                  <span className="max-w-[100px] truncate">{user.user_metadata?.full_name as string ?? user.email}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleSignOut()} className="text-destructive focus:text-destructive">
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
                  <HardDrive className="mr-2 h-3.5 w-3.5" />
                  Local storage
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
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs text-destructive focus:text-destructive" onClick={() => void handleSignOut()}>
                  로그아웃
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
            {/* Capture panel: sub-tabs [Record | Sessions] */}
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{ display: mobileMainTab === "capture" ? "flex" : "none" }}
            >
              {/* Sub-tab bar */}
              <div className="flex shrink-0 gap-0 border-b border-border bg-card px-3">
                {(["record", "sessions"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCaptureSubTab(tab)}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
                      captureSubTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab === "record" ? "Record" : "Sessions"}
                    {tab === "sessions" && conversations.length > 0 && (
                      <span className="rounded-full bg-muted px-1.5 py-0 text-[10px] tabular-nums">{conversations.length}</span>
                    )}
                  </button>
                ))}
              </div>
              {/* Sub-tab content */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ display: captureSubTab === "record" ? "flex" : "none" }}>
                {renderTranscription("flex-1 min-h-0")}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-16" style={{ display: captureSubTab === "sessions" ? "flex" : "none" }}>
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
            </div>

            {/* Words / Tutor panel */}
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{ display: mobileMainTab === "words" || mobileMainTab === "tutor" ? "flex" : "none" }}
            >
              {renderLibrary(true, mobileMainTab === "words" ? "vocabulary" : mobileMainTab === "tutor" ? "tutor" : undefined)}
            </div>

            {/* Tutor History panel */}
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{ display: mobileMainTab === "history" ? "flex" : "none" }}
            >
              <TutorHistoryPanel
                sessions={tutorSessions}
                onDeleteSession={handleDeleteTutorSession}
                hidePaddingBottom
              />
            </div>

            {/* Bottom navigation */}
            <nav
              className="shrink-0 border-t border-border bg-card/95 backdrop-blur-md"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="grid h-14 grid-cols-4">
                {(
                  [
                    { value: "tutor" as const, icon: MessageCircle, label: "Tutor" },
                    { value: "capture" as const, icon: Mic, label: "Capture" },
                    { value: "words" as const, icon: BookOpen, label: "Words" },
                    { value: "history" as const, icon: History, label: "History" },
                  ] as const
                ).map(({ value, icon: Icon, label }) => {
                  const isActive = mobileMainTab === value
                  const badgeCount =
                    value === "words" && !isActive && vocabulary.length > 0
                      ? vocabulary.length
                      : value === "history" && !isActive && tutorSessions.length > 0
                        ? tutorSessions.length
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
          /* ── Desktop: tab-based layout (same structure as mobile) ── */
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Recording indicator when not on Capture tab */}
            {isRecording && desktopMainTab !== "capture" && (
              <button
                onClick={() => setDesktopMainTab("capture")}
                className="flex w-full shrink-0 items-center gap-2 border-b border-recording/20 bg-recording/10 px-4 py-1.5"
              >
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-recording" />
                <span className="font-mono text-sm font-medium tabular-nums text-recording">
                  {String(Math.floor(duration / 60)).padStart(2, "0")}:{String(duration % 60).padStart(2, "0")}
                </span>
                <span className="text-sm text-recording">· Recording</span>
                <span className="ml-auto text-xs text-recording/60">View →</span>
              </button>
            )}

            {/* Top tab bar */}
            <nav className="shrink-0 border-b border-border bg-card/95">
              <div className="flex h-11 items-stretch">
                {(
                  [
                    { value: "tutor" as const, icon: MessageCircle, label: "Tutor" },
                    { value: "capture" as const, icon: Mic, label: "Capture" },
                    { value: "words" as const, icon: BookOpen, label: "Words" },
                    { value: "history" as const, icon: History, label: "History" },
                  ] as const
                ).map(({ value, icon: Icon, label }) => {
                  const isActive = desktopMainTab === value
                  const badgeCount =
                    value === "words" && vocabulary.length > 0 ? vocabulary.length
                    : value === "history" && tutorSessions.length > 0 ? tutorSessions.length
                    : null
                  return (
                    <button
                      key={value}
                      onClick={() => setDesktopMainTab(value)}
                      className={cn(
                        "relative flex items-center gap-2 border-b-2 px-5 text-sm font-medium transition-colors",
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", value === "capture" && isRecording && "text-recording")} />
                      {label}
                      {value === "capture" && isRecording && (
                        <span className="absolute right-2 top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-recording" />
                      )}
                      {badgeCount !== null && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </nav>

            {/* Tab content panels — always mounted, CSS show/hide */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ display: desktopMainTab === "capture" ? "flex" : "none" }}>
              {renderDesktopCapturePanel()}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ display: desktopMainTab === "tutor" || desktopMainTab === "words" ? "flex" : "none" }}>
              {renderLibrary(true, desktopMainTab === "words" ? "vocabulary" : "tutor")}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ display: desktopMainTab === "history" ? "flex" : "none" }}>
              <TutorHistoryPanel
                sessions={tutorSessions}
                onDeleteSession={handleDeleteTutorSession}
                className="min-h-0 flex-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Config dialog */}
      <ConfigDialog
        open={showConfig}
        onOpenChange={setShowConfig}
        onSave={(cfg) => {
          setStorageConfig(cfg)
          toast.success("Settings saved")
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
