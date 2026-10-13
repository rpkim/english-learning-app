"use client"

import { useState, useEffect, useCallback } from "react"
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
import { cn } from "@/lib/utils"
import { Copy, Check, KeyRound, Loader2, Trash2 } from "lucide-react"

interface ConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (config: StorageConfig) => void
}

export function ConfigDialog({ open, onOpenChange, onSave }: ConfigDialogProps) {
  const [localAsrModel, setLocalAsrModel] = useState<LocalAsrModel>("whisper-base")
  const [translationProviderRecent, setTranslationProviderRecent] = useState<TranslationProvider>("gemini")
  const [translationProviderAll, setTranslationProviderAll] = useState<TranslationProvider>("translate_api")

  useEffect(() => {
    if (open) {
      const cfg = getStorageConfig()
      setLocalAsrModel(cfg.localAsrModel ?? "whisper-base")
      setTranslationProviderRecent(cfg.translationProviderRecent ?? "gemini")
      setTranslationProviderAll(cfg.translationProviderAll ?? "translate_api")
    }
  }, [open])

  function handleSave() {
    const config: StorageConfig = {
      localAsrModel,
      translationProviderRecent,
      translationProviderAll,
    }
    saveStorageConfig(config)
    onSave(config)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex w-[calc(100%-1.25rem)] max-w-none flex-col gap-0 overflow-hidden p-0",
          "top-auto bottom-[max(0.75rem,env(safe-area-inset-bottom))] translate-y-0",
          "max-h-[min(92dvh,calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))]",
          "sm:top-[50%] sm:bottom-auto sm:max-w-md sm:max-h-[85vh] sm:translate-y-[-50%] sm:gap-4 sm:p-6",
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-3 sm:overflow-visible sm:px-0 sm:pt-0 sm:pb-0">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>설정</DialogTitle>
            <DialogDescription>
              음성 인식, 번역, REST/MCP API 키를 설정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">음성 인식 모델 (로컬, 오픈소스)</Label>
              <Select value={localAsrModel} onValueChange={(value) => setLocalAsrModel(value as LocalAsrModel)}>
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-w-[min(calc(100vw-2rem),20rem)]">
                  {LOCAL_ASR_MODELS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {localAsrSelectLabel(id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                기본값 Whisper Base. 캡션이 느리면 Tiny, 음질이 어려우면 Small 계열을 시도해 보세요.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">최근 구간 번역</Label>
              <Select value={translationProviderRecent} onValueChange={(value) => setTranslationProviderRecent(value as TranslationProvider)}>
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="gemini">Gemini API (품질 우선)</SelectItem>
                  <SelectItem value="translate_api">Translate API (비용 절약)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">전체 번역</Label>
              <Select value={translationProviderAll} onValueChange={(value) => setTranslationProviderAll(value as TranslationProvider)}>
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="gemini">Gemini API (품질 우선)</SelectItem>
                  <SelectItem value="translate_api">Translate API (비용 절약)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ApiKeysSection open={open} />
          </div>
        </div>

        <DialogFooter
          className={cn(
            "shrink-0 gap-2 border-t border-border/60 bg-background px-4 py-3",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:border-0 sm:px-0 sm:py-0 sm:pb-0",
          )}
        >
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSave}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ApiKeyRow = {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
}

function ApiKeysSection({ open }: { open: boolean }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/keys")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load API keys")
        setKeys([])
        return
      }
      setKeys(Array.isArray(data.items) ? data.items : [])
    } catch {
      setError("Failed to load API keys")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setCreatedKey(null)
      setCopied(false)
      setName("")
      return
    }
    void load()
  }, [open, load])

  async function handleCreate() {
    setCreating(true)
    setError(null)
    setCopied(false)
    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "default" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to create key")
        return
      }
      setCreatedKey(typeof data.key === "string" ? data.key : null)
      setName("")
      await load()
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    setError(null)
    const res = await fetch(`/api/v1/keys/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(typeof data.error === "string" ? data.error : "Failed to revoke key")
      return
    }
    setKeys((prev) => prev.filter((k) => k.id !== id))
  }

  async function handleCopy() {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-2 border-t border-border/60 pt-4">
      <div className="flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-xs">API keys (REST / MCP)</Label>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Agents and scripts use <code className="text-[10px]">Authorization: Bearer se_live_…</code>.
        The full key is shown only once.
      </p>

      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (optional)"
          className="h-9 text-sm"
        />
        <Button type="button" size="sm" className="h-9 shrink-0" onClick={() => void handleCreate()} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
        </Button>
      </div>

      {createdKey && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
          <p className="mb-1 text-[11px] text-amber-800 dark:text-amber-200">Copy now — it will not be shown again.</p>
          <div className="flex items-center gap-1.5">
            <code className="min-w-0 flex-1 truncate text-[11px]">{createdKey}</code>
            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => void handleCopy()}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Loading keys…</p>
      ) : keys.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No keys yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{k.name}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">{k.key_prefix}…</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => void handleRevoke(k.id)}>
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Revoke</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function localAsrSelectLabel(id: LocalAsrModel): string {
  switch (id) {
    case "whisper-base":      return "Whisper Base (기본 — 균형)"
    case "whisper-tiny":      return "Whisper Tiny (가장 빠름)"
    case "wav2vec2-base-960h":      return "Wav2Vec2 Base 960h"
    case "distil-whisper-small-en": return "Distil-Whisper Small EN"
    case "whisper-small":     return "Whisper Small (고품질, 무거움)"
    case "wav2vec2-large-xlsr-53-en": return "Wav2Vec2 Large XLSR (EN)"
    default: return id
  }
}
