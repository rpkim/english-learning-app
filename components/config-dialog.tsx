"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  getStorageConfig,
  saveStorageConfig,
  StorageConfig,
  TranslationProvider,
  LOCAL_ASR_MODELS,
  type LocalAsrModel,
} from "@/lib/storage-config"

interface ConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (config: StorageConfig) => void
}

export function ConfigDialog({ open, onOpenChange, onSave }: ConfigDialogProps) {
  const [localAsrModel, setLocalAsrModel] = useState<LocalAsrModel>("whisper-base")
  const [translationProviderRecent, setTranslationProviderRecent] = useState<TranslationProvider>("gemini")
  const [translationProviderAll, setTranslationProviderAll] = useState<TranslationProvider>("translate_api")
  const [topWordExcludes, setTopWordExcludes] = useState<string[]>([])
  const [excludeInput, setExcludeInput] = useState("")

  useEffect(() => {
    if (open) {
      const cfg = getStorageConfig()
      setLocalAsrModel(cfg.localAsrModel ?? "whisper-base")
      setTranslationProviderRecent(cfg.translationProviderRecent ?? "gemini")
      setTranslationProviderAll(cfg.translationProviderAll ?? "translate_api")
      setTopWordExcludes(Array.isArray(cfg.topWordExcludes) ? cfg.topWordExcludes : [])
      setExcludeInput("")
    }
  }, [open])

  function handleSave() {
    const config: StorageConfig = {
      localAsrModel,
      translationProviderRecent,
      translationProviderAll,
      topWordExcludes,
    }
    saveStorageConfig(config)
    onSave(config)
    onOpenChange(false)
  }

  function handleAddExcludeWord() {
    const word = excludeInput.trim().toLowerCase()
    if (!word) return
    if (topWordExcludes.includes(word)) {
      setExcludeInput("")
      return
    }
    setTopWordExcludes((prev) => [...prev, word].sort())
    setExcludeInput("")
  }

  function handleRemoveExcludeWord(word: string) {
    setTopWordExcludes((prev) => prev.filter((w) => w !== word))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure transcription model, translation providers, and word filters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs">Transcription model (local, open source)</Label>
          <Select value={localAsrModel} onValueChange={(value) => setLocalAsrModel(value as LocalAsrModel)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCAL_ASR_MODELS.map((id) => (
                <SelectItem key={id} value={id}>
                  {localAsrSelectLabel(id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Default is Whisper Base for usable accuracy on a laptop. If captions lag, try Tiny or Wav2Vec2 Base; for harder audio, try Distil or Whisper Small (slower, more RAM).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Translate recent provider</Label>
          <Select value={translationProviderRecent} onValueChange={(value) => setTranslationProviderRecent(value as TranslationProvider)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Gemini API (better quality)</SelectItem>
              <SelectItem value="translate_api">Translate API (lower cost)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Translate all provider</Label>
          <Select value={translationProviderAll} onValueChange={(value) => setTranslationProviderAll(value as TranslationProvider)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Gemini API (better quality)</SelectItem>
              <SelectItem value="translate_api">Translate API (lower cost)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Top words exclude list</Label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Add word to exclude (e.g. trump)"
              value={excludeInput}
              onChange={(e) => setExcludeInput(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddExcludeWord()
                }
              }}
            />
            <Button type="button" variant="outline" className="h-8" onClick={handleAddExcludeWord}>
              Add
            </Button>
          </div>
          {topWordExcludes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {topWordExcludes.map((word) => (
                <button
                  key={word}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                  onClick={() => handleRemoveExcludeWord(word)}
                  title="Remove excluded word"
                >
                  <span>{word}</span>
                  <span className="text-xs">×</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No excluded words yet.</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function localAsrSelectLabel(id: LocalAsrModel): string {
  switch (id) {
    case "whisper-base":      return "Whisper Base (default — quality vs speed)"
    case "whisper-tiny":      return "Whisper Tiny (fastest, lower quality)"
    case "wav2vec2-base-960h":      return "Wav2Vec2 Base 960h (CTC, often quick)"
    case "distil-whisper-small-en": return "Distil-Whisper Small EN (slower, stronger)"
    case "whisper-small":     return "Whisper Small (best Whisper, heavier)"
    case "wav2vec2-large-xlsr-53-en": return "Wav2Vec2 Large XLSR English (Meta CTC)"
    default: return id
  }
}
