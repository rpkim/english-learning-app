"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, Trash2, ChevronDown, ChevronUp, MessageCircle, User, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TutorSession } from "@/lib/types"

interface TutorHistoryPanelProps {
  sessions: TutorSession[]
  onDeleteSession: (id: string) => void
  className?: string
  hidePaddingBottom?: boolean
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function TutorHistoryPanel({ sessions, onDeleteSession, className, hidePaddingBottom }: TutorHistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const runAnalysis = async () => {
    if (sessions.length === 0 || analyzing) return
    setAnalyzing(true)
    setAnalysisError(null)
    setAnalysis(null)
    try {
      const res = await fetch("/api/tutor-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAnalysisError(typeof data?.error === "string" ? data.error : "분석에 실패했습니다.")
        return
      }
      setAnalysis(typeof data?.analysis === "string" ? data.analysis : "")
    } catch {
      setAnalysisError("네트워크 오류가 발생했습니다.")
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {/* AI Insights header */}
      <div className="shrink-0 border-b border-border/60 px-3 py-2.5 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">학습 히스토리</p>
            <p className="text-[11px] text-muted-foreground">{sessions.length}개의 대화 저장됨</p>
          </div>
          <Button
            size="sm"
            variant={analysis ? "secondary" : "default"}
            className="h-8 gap-1.5 text-xs"
            disabled={sessions.length === 0 || analyzing}
            onClick={runAnalysis}
          >
            {analyzing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
            {analyzing ? "분석 중…" : "AI 분석"}
          </Button>
        </div>

        {/* Analysis result */}
        {(analysis || analysisError) && (
          <div className={cn(
            "mt-2.5 rounded-xl border p-3 text-sm leading-relaxed",
            analysisError
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-primary/20 bg-primary/5 text-foreground"
          )}>
            {analysisError
              ? analysisError
              : <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{analysis}</p>
            }
          </div>
        )}
      </div>

      {/* Sessions list */}
      <div className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 sm:px-3",
        hidePaddingBottom ? "pb-20" : "pb-4"
      )}>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 opacity-20" />
            <p className="max-w-[22ch] text-sm leading-relaxed text-balance">
              Tutor 대화가 저장되면 여기에 나타납니다.
            </p>
            <p className="max-w-[26ch] text-[11px] leading-relaxed text-muted-foreground/70 text-balance">
              대화를 Clear하거나 앱을 닫으면 자동으로 저장됩니다.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sessions.map((session) => {
              const isExpanded = expandedId === session.id
              const userMsgCount = session.messages.filter((m) => m.role === "user").length
              const preview = session.messages.find((m) => m.role === "user")?.content.slice(0, 80) ?? ""
              return (
                <div
                  key={session.id}
                  className="group rounded-xl border border-border/60 bg-card transition-all"
                >
                  {/* Session header */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : session.id)}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{session.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDate(session.created_at)} · {userMsgCount}개의 질문
                      </p>
                      {!isExpanded && preview && (
                        <p className="mt-1 truncate text-[11px] text-muted-foreground/70">{preview}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id) }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded messages */}
                  {isExpanded && (
                    <div className="border-t border-border/40 px-3 py-2.5 space-y-2">
                      {session.messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "flex gap-2 text-[13px] leading-relaxed",
                            msg.role === "user" ? "flex-row-reverse" : "flex-row"
                          )}
                        >
                          <div className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                            msg.role === "user" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            {msg.role === "user"
                              ? <User className="h-3 w-3" />
                              : <Bot className="h-3 w-3" />}
                          </div>
                          <div className={cn(
                            "max-w-[85%] rounded-xl px-2.5 py-1.5",
                            msg.role === "user"
                              ? "bg-primary/10 text-foreground"
                              : "bg-muted/60 text-foreground/85"
                          )}>
                            <p className="whitespace-pre-wrap wrap-anywhere">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
