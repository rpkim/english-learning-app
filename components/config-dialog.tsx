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
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getStorageConfig, saveStorageConfig, StorageConfig, StorageMode, TranslationProvider, WhisperModel } from "@/lib/storage-config"
import { Database, HardDrive, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (config: StorageConfig) => void
}

export function ConfigDialog({ open, onOpenChange, onSave }: ConfigDialogProps) {
  const [mode, setMode] = useState<StorageMode>("local")
  const [supabaseUrl, setSupabaseUrl] = useState("")
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("")
  const [whisperModel, setWhisperModel] = useState<WhisperModel>("tiny")
  const [translationProviderRecent, setTranslationProviderRecent] = useState<TranslationProvider>("gemini")
  const [translationProviderAll, setTranslationProviderAll] = useState<TranslationProvider>("translate_api")
  const [topWordExcludes, setTopWordExcludes] = useState<string[]>([])
  const [excludeInput, setExcludeInput] = useState("")

  // Load saved config when dialog opens
  useEffect(() => {
    if (open) {
      const cfg = getStorageConfig()
      setMode(cfg.mode)
      setSupabaseUrl(cfg.supabaseUrl)
      setSupabaseAnonKey(cfg.supabaseAnonKey)
      setWhisperModel(cfg.whisperModel === "medium" ? "small" : (cfg.whisperModel ?? "tiny"))
      setTranslationProviderRecent(cfg.translationProviderRecent ?? "gemini")
      setTranslationProviderAll(cfg.translationProviderAll ?? "translate_api")
      setTopWordExcludes(Array.isArray(cfg.topWordExcludes) ? cfg.topWordExcludes : [])
      setExcludeInput("")
    }
  }, [open])

  const urlValid = mode === "local" || (supabaseUrl.startsWith("https://") && supabaseUrl.includes(".supabase.co"))
  const keyValid = mode === "local" || supabaseAnonKey.length > 20
  const canSave = mode === "local" || (urlValid && keyValid)

  function handleSave() {
    const config: StorageConfig = {
      mode,
      supabaseUrl,
      supabaseAnonKey,
      whisperModel,
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
          <DialogTitle className="flex items-center gap-2">
            Storage Configuration
          </DialogTitle>
          <DialogDescription>
            Choose where vocabulary and conversations are saved.
          </DialogDescription>
        </DialogHeader>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3 py-2">
          <ModeCard
            selected={mode === "supabase"}
            onClick={() => setMode("supabase")}
            icon={<Database className="h-5 w-5" />}
            title="Supabase"
            description="Persistent PostgreSQL — data survives across sessions and devices"
          />
          <ModeCard
            selected={mode === "local"}
            onClick={() => setMode("local")}
            icon={<HardDrive className="h-5 w-5" />}
            title="Local only"
            description="Stored in browser localStorage — fast, no setup, this device only"
          />
        </div>

        {/* Supabase credentials */}
        {mode === "supabase" && (
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 leading-relaxed">
              Leave empty to use the built-in Supabase project already connected to this app.
              Fill in below to use your own Supabase project.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supabase-url" className="text-xs">
                Project URL
                <span className="text-muted-foreground ml-1">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="supabase-url"
                  placeholder="https://xxxxxxxxxxxx.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className={cn(
                    "font-mono text-xs pr-8",
                    supabaseUrl && !urlValid && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {supabaseUrl && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {urlValid
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                      : <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supabase-key" className="text-xs">
                Anon / Public Key
                <span className="text-muted-foreground ml-1">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="supabase-key"
                  type="password"
                  placeholder="eyJhbGci..."
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  className={cn(
                    "font-mono text-xs pr-8",
                    supabaseAnonKey && !keyValid && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {supabaseAnonKey && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {keyValid
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                      : <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === "local" && (
          <div className="bg-muted rounded-md px-3 py-2 text-xs text-muted-foreground leading-relaxed">
            Data is saved to <code className="font-mono text-foreground">localStorage</code> in your
            browser. Clearing browser data will erase all sessions and vocabulary.
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Transcription model</Label>
          <Select value={whisperModel} onValueChange={(value) => setWhisperModel(value as WhisperModel)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tiny">Whisper Tiny (faster)</SelectItem>
              <SelectItem value="base">Whisper Base (more accurate)</SelectItem>
              <SelectItem value="small">Whisper Small (higher quality, slower)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Bigger models improve accuracy but increase latency and memory usage.
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
          <Label className="text-xs">Top words exclude management</Label>
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
                  <span className="text-xs">x</span>
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
          <Button onClick={handleSave} disabled={!canSave}>
            Save & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Mode card ────────────────────────────────────────────────

function ModeCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/40 hover:bg-muted"
      )}
    >
      <div className={cn("rounded-md p-1.5", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
          {title}
          {selected && <Badge variant="secondary" className="text-xs h-4 px-1">Active</Badge>}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</p>
      </div>
    </button>
  )
}
