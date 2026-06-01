"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VocabularyItem } from "@/lib/types"
import { VocabularyCard } from "@/components/vocabulary-card"

interface VocabularyDeckProps {
  items: VocabularyItem[]
  onToggleMastered: (id: string, current: boolean) => void
  onTranslate: (item: VocabularyItem) => void
  onUpdateItem?: (id: string, fields: Partial<Pick<VocabularyItem, "extra_examples" | "etymology" | "related_forms" | "view_count" | "user_sentences">>) => void | Promise<void>
  translatingId: string | null
  className?: string
}

export function VocabularyDeck({
  items,
  onToggleMastered,
  onTranslate,
  onUpdateItem,
  translatingId,
  className,
}: VocabularyDeckProps) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<"left" | "right" | null>(null)
  const [animating, setAnimating] = useState(false)
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])

  // Clamp index whenever items array reference changes (covers filter/delete)
  useEffect(() => {
    setIndex((i) => (items.length === 0 ? 0 : Math.min(i, items.length - 1)))
  }, [items])

  const go = useCallback((delta: number) => {
    if (animating || itemsRef.current.length <= 1) return
    const next = index + delta
    if (next < 0 || next >= itemsRef.current.length) return
    setDirection(delta > 0 ? "left" : "right")
    setAnimating(true)
    setTimeout(() => {
      // Clamp against latest items in case array changed during animation
      setIndex(Math.min(next, Math.max(0, itemsRef.current.length - 1)))
      setDirection(null)
      setAnimating(false)
    }, 180)
  }, [animating, index])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1)
      if (e.key === "ArrowRight") go(1)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [go])

  // Touch swipe — use non-passive listener so horizontal swipes don't scroll the page
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const swipeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = swipeRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return
      const dx = e.touches[0].clientX - touchStartX.current
      const dy = e.touches[0].clientY - touchStartY.current
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        e.preventDefault()
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = e.changedTouches[0].clientY - touchStartY.current
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        go(dx < 0 ? 1 : -1)
      }
      touchStartX.current = null
      touchStartY.current = null
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
    }
  }, [go])

  if (items.length === 0) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center gap-3 text-center", className)}>
        <BookOpen className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">저장된 단어가 없습니다.</p>
      </div>
    )
  }

  const safeIndex = items.length > 0 ? Math.max(0, Math.min(index, items.length - 1)) : 0
  const item = items[safeIndex]
  if (!item) return null

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Card area — swipeable */}
      <div
        ref={swipeRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-4 py-4 sm:px-8 md:px-12"
      >
        <div
          className={cn(
            "rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-180",
            animating && direction === "left" && "-translate-x-4 opacity-0",
            animating && direction === "right" && "translate-x-4 opacity-0",
            !animating && "translate-x-0 opacity-100",
            item?.is_mastered && "opacity-60"
          )}
        >
          <VocabularyCard
            key={item.id}
            item={item}
            onToggleMastered={onToggleMastered}
            onTranslate={onTranslate}
            onUpdateItem={onUpdateItem}
            isTranslating={translatingId === item.id}
            variant="full"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="shrink-0 border-t border-border/40 px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Dot indicators + counter */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1">
              {items.slice(Math.max(0, index - 3), index + 4).map((it, i) => {
                const realIdx = Math.max(0, index - 3) + i
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setIndex(realIdx)}
                    className={cn(
                      "rounded-full transition-all",
                      realIdx === index
                        ? "h-2 w-5 bg-primary"
                        : "h-1.5 w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                    )}
                  />
                )
              })}
              {items.length > 7 && <span className="ml-1 text-[10px] text-muted-foreground">…</span>}
            </div>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {index + 1} / {items.length}
            </p>
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === items.length - 1}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
