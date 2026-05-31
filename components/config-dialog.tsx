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
              음성 인식 모델(Whisper 등)과 번역 API를 설정합니다.
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
