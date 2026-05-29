"use client"

import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Sparkles, Plus, Check, FileText, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VocabularyItem } from "@/lib/types"
import { useLocale } from "@/lib/locale-context"

export type AddVocabPayload = {
  word: string
  type: VocabularyItem["type"]
  definition?: string
  example_sentence?: string
  korean_translation?: string
  context?: string
}

interface AddVocabDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddItems: (items: AddVocabPayload[]) => Promise<void>
}

type ExtractedWord = AddVocabPayload & { selected: boolean }

// ── Single Word Tab ──────────────────────────────────────────────────────────
function SingleWordTab({
  onAdd,
  onClose,
}: {
  onAdd: (item: AddVocabPayload) => Promise<void>
  onClose: () => void
}) {
  const { locale, strings } = useLocale()
  const [word, setWord] = useState("")
  const [type, setType] = useState<VocabularyItem["type"]>("word")
  const [definition, setDefinition] = useState("")
  const [example, setExample] = useState("")
  const [nativeTranslation, setNativeTranslation] = useState("")
  const [isLooking, setIsLooking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lookupDone, setLookupDone] = useState(false)

  const handleLookup = useCallback(async () => {
    if (!word.trim()) return
    setIsLooking(true)
    setLookupDone(false)
    try {
      const res = await fetch("/api/tutor-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: word.trim(), type: "meaning", targetLang: locale }),
      })
      if (!res.ok) return
      const data = await res.json() as {
        meaning?: string; nuance?: string; examples?: { en: string; ko: string }[]
      }
      if (data.meaning) setNativeTranslation(data.meaning)
      if (data.nuance) setDefinition(data.nuance)
      if (data.examples?.[0]?.en) setExample(data.examples[0].en)
      setLookupDone(true)
    } finally {
      setIsLooking(false)
    }
  }, [word, locale])

  const handleSave = async () => {
    if (!word.trim()) return
    setIsSaving(true)
    try {
      await onAdd({
        word: word.trim(),
        type,
        definition: definition || undefined,
        example_sentence: example || undefined,
        korean_translation: nativeTranslation || undefined,
      })
      setWord(""); setDefinition(""); setExample(""); setNativeTranslation("")
      setType("word"); setLookupDone(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Word input + lookup */}
      <div className="flex gap-2">
        <Input
          value={word}
          onChange={(e) => { setWord(e.target.value); setLookupDone(false) }}
          placeholder="e.g. leverage, kick the bucket…"
          className="flex-1 h-9 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") void handleLookup() }}
          autoFocus
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 shrink-0"
          onClick={() => void handleLookup()}
          disabled={!word.trim() || isLooking}
        >
          {isLooking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          AI 조회
        </Button>
      </div>

      {/* Type selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">유형</span>
        <Select value={type} onValueChange={(v) => setType(v as VocabularyItem["type"])}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="word">Word</SelectItem>
            <SelectItem value="expression">Expression</SelectItem>
            <SelectItem value="idiom">Idiom</SelectItem>
            <SelectItem value="phrasal_verb">Phrasal Verb</SelectItem>
            <SelectItem value="slang">Slang</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* AI-filled fields */}
      <div className={cn(
        "grid gap-2 rounded-xl border bg-muted/30 p-3 transition-all",
        lookupDone ? "border-primary/30" : "border-border/50"
      )}>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            뜻
          </p>
          <Input
            value={nativeTranslation}
            onChange={(e) => setNativeTranslation(e.target.value)}
            placeholder="한국어/native 뜻을 입력하거나 AI 조회 버튼을 누르세요"
            className="h-8 text-xs border-0 bg-transparent shadow-none px-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
          />
        </div>
        <div className="border-t border-border/30 pt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            뉘앙스 / 정의
          </p>
          <Textarea
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            placeholder="뉘앙스나 영어 정의"
            rows={2}
            className="min-h-0 resize-none border-0 bg-transparent shadow-none px-0 text-xs focus-visible:ring-0 placeholder:text-muted-foreground/40"
          />
        </div>
        <div className="border-t border-border/30 pt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            예문
          </p>
          <Input
            value={example}
            onChange={(e) => setExample(e.target.value)}
            placeholder="예문"
            className="h-8 text-xs border-0 bg-transparent shadow-none px-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 h-9">
          취소
        </Button>
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={!word.trim() || isSaving}
          className="flex-1 h-9 gap-1.5"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          단어장에 추가
        </Button>
      </div>
    </div>
  )
}

// ── Bulk Extract Tab ─────────────────────────────────────────────────────────
function BulkExtractTab({
  onAdd,
  onClose,
}: {
  onAdd: (items: AddVocabPayload[]) => Promise<void>
  onClose: () => void
}) {
  const { locale } = useLocale()
  const [text, setText] = useState("")
  const [words, setWords] = useState<ExtractedWord[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [extracted, setExtracted] = useState(false)

  const handleExtract = useCallback(async () => {
    if (!text.trim()) return
    setIsExtracting(true)
    setWords([])
    setExtracted(false)
    try {
      const res = await fetch("/api/extract-vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), targetLang: locale }),
      })
      if (!res.ok) return
      const data = await res.json() as { items: Omit<ExtractedWord, "selected">[] }
      setWords((data.items ?? []).map((item) => ({ ...item, selected: true })))
      setExtracted(true)
    } finally {
      setIsExtracting(false)
    }
  }, [text, locale])

  const toggleWord = (idx: number) =>
    setWords((prev) => prev.map((w, i) => i === idx ? { ...w, selected: !w.selected } : w))

  const toggleAll = () => {
    const allSelected = words.every((w) => w.selected)
    setWords((prev) => prev.map((w) => ({ ...w, selected: !allSelected })))
  }

  const selectedCount = words.filter((w) => w.selected).length

  const handleSave = async () => {
    const selected = words.filter((w) => w.selected)
    if (selected.length === 0) return
    setIsSaving(true)
    try {
      await onAdd(selected.map(({ selected: _, ...rest }) => rest))
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!extracted ? (
        <>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              문장이나 단락을 붙여넣으면 AI가 유용한 단어들을 추출해줘요.
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Paste English text here — sentences, a paragraph, or a list of words (one per line)…\n\ne.g. The conference was postponed due to an unprecedented surge in demand."}
              rows={6}
              className="text-sm resize-none"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 h-9">취소</Button>
            <Button
              size="sm"
              onClick={() => void handleExtract()}
              disabled={!text.trim() || isExtracting}
              className="flex-1 h-9 gap-1.5"
            >
              {isExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isExtracting ? "추출 중…" : "AI 단어 추출"}
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Header with select all */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">
              {words.length}개 단어 추출됨
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-primary hover:underline"
            >
              {words.every((w) => w.selected) ? "모두 해제" : "모두 선택"}
            </button>
          </div>

          {/* Word list */}
          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[55vh]">
            {words.map((word, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => toggleWord(idx)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                  word.selected
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/50 bg-muted/20 opacity-60"
                )}
              >
                {/* Checkbox */}
                <div className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all",
                  word.selected ? "border-primary bg-primary" : "border-border"
                )}>
                  {word.selected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">{word.word}</span>
                    <span className="text-[10px] text-muted-foreground border border-border/50 rounded px-1">
                      {word.type}
                    </span>
                  </div>
                  {word.korean_translation && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{word.korean_translation}</p>
                  )}
                  {word.definition && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{word.definition}</p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setExtracted(false); setWords([]) }}
              className="h-9"
            >
              ← 다시 입력
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={selectedCount === 0 || isSaving}
              className="flex-1 h-9 gap-1.5"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {selectedCount}개 추가
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Dialog ──────────────────────────────────────────────────────────────
export function AddVocabDialog({ open, onOpenChange, onAddItems }: AddVocabDialogProps) {
  const [tab, setTab] = useState<"single" | "bulk">("single")

  const handleClose = () => onOpenChange(false)

  const handleAddSingle = async (item: AddVocabPayload) => {
    await onAddItems([item])
    onOpenChange(false)
  }

  const handleAddBulk = async (items: AddVocabPayload[]) => {
    await onAddItems(items)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-base">단어 추가</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 px-5 pt-3 pb-0">
          <button
            type="button"
            onClick={() => setTab("single")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              tab === "single"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Type className="h-3.5 w-3.5" />
            단어 직접 추가
          </button>
          <button
            type="button"
            onClick={() => setTab("bulk")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              tab === "bulk"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            문장에서 일괄 추출
          </button>
        </div>

        <div className="p-5">
          {tab === "single" ? (
            <SingleWordTab onAdd={handleAddSingle} onClose={handleClose} />
          ) : (
            <BulkExtractTab onAdd={handleAddBulk} onClose={handleClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
