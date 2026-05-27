"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, Trash2, ChevronDown, ChevronUp, MessageCircle, HelpCircle, Languages, Wand2, BookOpen, FileText, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TutorSession } from "@/lib/types"
import type { TutorAnalysisResult, WordRec, SentenceRec, GrammarRec } from "@/app/api/tutor-analysis/route"

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

// ── Analysis cards ─────────────────────────────────────────────────────────

function WordRecsCard({ insight, items, count }: { insight: string; items: WordRec[]; count: number }) {
  return (
    <div className="rounded-xl border border-blue-500/25 bg-blue-500/5">
      <div className="flex items-center gap-2.5 border-b border-blue-500/15 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">단어 추천</p>
          <p className="text-[11px] text-muted-foreground">뜻이 뭐야? {count}회 기록</p>
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">
        <p className="text-[12px] leading-relaxed text-muted-foreground">{insight}</p>
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((w, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-background/60 px-3 py-2.5 border border-border/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[14px] text-foreground">{w.word}</span>
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                      {w.level}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{w.ko}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1 leading-relaxed">{w.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SentenceRecsCard({ insight, items, count }: { insight: string; items: SentenceRec[]; count: number }) {
  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/5">
      <div className="flex items-center gap-2.5 border-b border-violet-500/15 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">번역 연습 문장</p>
          <p className="text-[11px] text-muted-foreground">번역해줘 {count}회 기록</p>
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">
        <p className="text-[12px] leading-relaxed text-muted-foreground">{insight}</p>
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((s, i) => (
              <div key={i} className="rounded-lg bg-background/60 px-3 py-2.5 border border-border/40">
                <div className="flex items-start gap-2 justify-between">
                  <p className="text-[13px] font-medium text-foreground leading-relaxed flex-1">{s.en}</p>
                  <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                    {s.level}
                  </span>
                </div>
                {s.ko_hint && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.ko_hint}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GrammarRecsCard({ insight, items, count }: { insight: string; items: GrammarRec[]; count: number }) {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5">
      <div className="flex items-center gap-2.5 border-b border-amber-500/15 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Wand2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">문법 개선 포인트</p>
          <p className="text-[11px] text-muted-foreground">더 자연스럽게 {count}회 기록</p>
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">
        <p className="text-[12px] leading-relaxed text-muted-foreground">{insight}</p>
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((g, i) => (
              <div key={i} className="rounded-lg bg-background/60 px-3 py-2.5 border border-border/40">
                <p className="text-[13px] font-semibold text-amber-700 dark:text-amber-400">{g.area}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{g.tip}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function TutorHistoryPanel({ sessions, onDeleteSession, className, hidePaddingBottom }: TutorHistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<TutorAnalysisResult | null>(null)
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
      setAnalysis(data as TutorAnalysisResult)
    } catch {
      setAnalysisError("네트워크 오류가 발생했습니다.")
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="shrink-0 border-b border-border/60 px-3 py-2.5 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">학습 히스토리</p>
            <p className="text-[11px] text-muted-foreground">{sessions.length}개의 기록 저장됨</p>
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
            {analyzing ? "분석 중…" : analysis ? "다시 분석" : "AI 분석"}
          </Button>
        </div>

        {/* Stats row */}
        {sessions.length > 0 && !analyzing && !analysis && (
          <div className="mt-2.5 flex gap-2">
            {[
              { label: "뜻이 뭐야?", icon: HelpCircle, color: "text-blue-500" },
              { label: "번역해줘", icon: Languages, color: "text-violet-500" },
              { label: "더 자연스럽게", icon: Wand2, color: "text-amber-500" },
            ].map(({ label, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Icon className={cn("h-3 w-3", color)} />
                {label}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {analysisError && (
          <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{analysisError}</span>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-3 sm:px-3",
        hidePaddingBottom ? "pb-20" : "pb-4"
      )}>

        {/* Analysis result cards */}
        {analysis && (
          <div className="mb-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1">AI 분석 결과</p>
            <WordRecsCard
              insight={analysis.meaning.insight}
              items={analysis.meaning.items ?? []}
              count={analysis.meaning.count}
            />
            <SentenceRecsCard
              insight={analysis.translate.insight}
              items={analysis.translate.items ?? []}
              count={analysis.translate.count}
            />
            <GrammarRecsCard
              insight={analysis.naturalize.insight}
              items={analysis.naturalize.items ?? []}
              count={analysis.naturalize.count}
            />
            <div className="h-px border-t border-border/40 mt-1" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1">기록</p>
          </div>
        )}

        {/* Sessions list */}
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 opacity-20" />
            <p className="max-w-[22ch] text-sm leading-relaxed text-balance">
              Tutor 기록이 저장되면 여기에 나타납니다.
            </p>
            <p className="max-w-[26ch] text-[11px] leading-relaxed text-muted-foreground/70 text-balance">
              단어를 검색하거나 문장을 입력해 보세요.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sessions.map((session) => {
              const isExpanded = expandedId === session.id
              const userMsgCount = session.messages.filter((m) => m.role === "user").length
              const preview = session.messages.find((m) => m.role === "user")?.content.slice(0, 80) ?? ""

              // Determine session type for icon/color
              let sessionType: "meaning" | "translate" | "naturalize" = "meaning"
              const assistantMsg = session.messages.find((m) => m.role === "assistant")
              if (assistantMsg) {
                try {
                  const parsed = JSON.parse(assistantMsg.content) as { type?: string }
                  if (parsed.type === "translate" || parsed.type === "naturalize") sessionType = parsed.type
                } catch { /* ignore */ }
              }
              const typeConfig = {
                meaning:    { icon: HelpCircle,  color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",   label: "뜻" },
                translate:  { icon: Languages,   color: "bg-violet-500/10 text-violet-600 dark:text-violet-400", label: "번역" },
                naturalize: { icon: Wand2,       color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",  label: "교정" },
              }[sessionType]
              const TypeIcon = typeConfig.icon

              return (
                <div
                  key={session.id}
                  className="group rounded-xl border border-border/60 bg-card transition-all"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(isExpanded ? null : session.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedId(isExpanded ? null : session.id) }}
                    className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left"
                  >
                    <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", typeConfig.color)}>
                      <TypeIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{session.title}</p>
                        <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium", typeConfig.color)}>
                          {typeConfig.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDate(session.created_at)} · {userMsgCount}개 질문
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
                  </div>

                  {/* Expanded view: show structured result */}
                  {isExpanded && (
                    <div className="border-t border-border/40 px-3 py-3 space-y-2">
                      {session.messages.map((msg, idx) => {
                        if (msg.role === "assistant") {
                          // Try to render structured assistant content
                          try {
                            const parsed = JSON.parse(msg.content) as {
                              type?: string; query?: string; meaning?: string; translation?: string; improved?: string
                            }
                            return (
                              <div key={idx} className="rounded-lg bg-muted/40 px-3 py-2.5">
                                <p className="text-[11px] text-muted-foreground/60 mb-1.5">AI 응답</p>
                                {parsed.meaning && <p className="text-[13px]"><span className="text-muted-foreground">의미: </span>{parsed.meaning}</p>}
                                {parsed.translation && <p className="text-[13px]"><span className="text-muted-foreground">번역: </span>{parsed.translation}</p>}
                                {parsed.improved && <p className="text-[13px]"><span className="text-muted-foreground">교정: </span>{parsed.improved}</p>}
                              </div>
                            )
                          } catch {
                            return null
                          }
                        }
                        return (
                          <div key={idx} className="flex gap-2 text-[13px] justify-end">
                            <div className="max-w-[85%] rounded-xl bg-primary/10 px-2.5 py-1.5 text-foreground">
                              <p className="whitespace-pre-wrap wrap-anywhere">{msg.content}</p>
                            </div>
                          </div>
                        )
                      })}
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
