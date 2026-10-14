"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Copy, Check, KeyRound, Loader2, Trash2 } from "lucide-react"

type ApiKeyRow = {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
}

function formatApiError(message: string): string {
  if (/sign in/i.test(message)) return "로그인해야 API 키를 발급할 수 있습니다. 잠시 후 다시 시도해 주세요."
  if (/not configured/i.test(message)) return "서버 설정이 아직 완료되지 않았습니다."
  if (/row-level security|permission denied|rls/i.test(message)) {
    return "키를 저장하지 못했습니다. api_keys 테이블 권한(RLS)을 확인해 주세요."
  }
  return message
}

async function keysFetch(path: string, init?: RequestInit): Promise<Response> {
  const sb = getSupabaseClient()
  await sb.auth.getUser()
  const { data: { session } } = await sb.auth.getSession()
  const headers = new Headers(init?.headers)
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`)
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  return fetch(path, { ...init, credentials: "include", cache: "no-store", headers })
}

export function ApiKeysPanel({ active }: { active: boolean }) {
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
      const res = await keysFetch("/api/v1/keys")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(formatApiError(typeof data.error === "string" ? data.error : "API 키를 불러오지 못했습니다."))
        setKeys([])
        return
      }
      setKeys(Array.isArray(data.items) ? data.items : [])
    } catch {
      setError("API 키를 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!active) {
      setCreatedKey(null)
      setCopied(false)
      setName("")
      return
    }
    void load()
  }, [active, load])

  async function handleCreate() {
    setCreating(true)
    setError(null)
    setCopied(false)
    try {
      const res = await keysFetch("/api/v1/keys", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() || "default" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(formatApiError(typeof data.error === "string" ? data.error : "키를 발급하지 못했습니다."))
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
    const res = await keysFetch(`/api/v1/keys/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(formatApiError(typeof data.error === "string" ? data.error : "키를 삭제하지 못했습니다."))
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
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-xs">API 키 (REST / MCP)</Label>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Google로 로그인한 계정에서 바로 발급합니다. 에이전트·스크립트는{" "}
        <code className="text-[10px]">Authorization: Bearer se_live_…</code>
        {" "}로 호출하세요. 전체 키는 만들 때 한 번만 보여 줍니다.
      </p>

      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="키 이름 (선택)"
          className="h-9 text-sm"
          autoComplete="off"
        />
        <Button type="button" size="sm" className="h-9 shrink-0" onClick={() => void handleCreate()} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "발급"}
        </Button>
      </div>

      {createdKey && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
          <p className="mb-1 text-[11px] text-amber-800 dark:text-amber-200">지금 복사하세요. 다시 보여 주지 않습니다.</p>
          <div className="flex items-center gap-1.5">
            <code className="min-w-0 flex-1 break-all text-[11px]">{createdKey}</code>
            <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => void handleCopy()}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {loading ? (
        <p className="text-[11px] text-muted-foreground">키 불러오는 중…</p>
      ) : keys.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">아직 키가 없습니다. 위에서 발급하세요.</p>
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
                <span className="sr-only">삭제</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ApiKeysDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-4 sm:overflow-visible sm:px-0 sm:pt-0 sm:pb-0">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>API 키</DialogTitle>
            <DialogDescription>
              로그인한 계정에서 REST·MCP용 키를 발급하고 삭제합니다. 저장 버튼을 누를 필요는 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <ApiKeysPanel active={open} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
