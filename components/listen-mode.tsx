"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Headphones, Pause, Play, SkipBack, SkipForward, Square, Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VocabularyItem } from "@/lib/types"
import { getKoreanTranslationText } from "@/components/vocabulary-card"

type ListenState = "idle" | "running"

interface Clip {
  itemId: string
  word: string
  meaning: string
  kind: "word" | "meaning"
  text: string
  lang: "en" | "ko"
  wordIndex: number
  wordTotal: number
  repeatIndex: number
  repeatTotal: number
}

function CollectionPicker({
  collections,
  selectedCollection,
  onSelect,
}: {
  collections: string[]
  selectedCollection: string | null
  onSelect: (col: string | null) => void
}) {
  if (collections.length === 0) return null
  return (
    <div className="w-full max-w-sm space-y-2 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">단어장 선택</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            selectedCollection === null
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground",
          )}
        >
          전체
        </button>
        {collections.map((col) => (
          <button
            key={col}
            type="button"
            onClick={() => onSelect(col)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              selectedCollection === col
                ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground",
            )}
          >
            {col}
          </button>
        ))}
      </div>
    </div>
  )
}

function CountStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 8,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-sm font-semibold hover:bg-muted disabled:opacity-30"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-bold tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-sm font-semibold hover:bg-muted disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  )
}

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"

function pickVoice(lang: "en" | "ko"): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (lang === "ko") {
    return (
      voices.find((v) => v.lang === "ko-KR") ||
      voices.find((v) => v.lang.startsWith("ko")) ||
      null
    )
  }
  return (
    voices.find((v) => v.lang === "en-US" && /samantha|karen|moira/i.test(v.name)) ||
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang.startsWith("en")) ||
    null
  )
}

function speakFallback(text: string, lang: "en" | "ko"): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve()
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === "ko" ? "ko-KR" : "en-US"
    utterance.rate = lang === "ko" ? 0.95 : 0.85
    const voice = pickVoice(lang)
    if (voice) utterance.voice = voice
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

function itemMeaning(item: VocabularyItem): string {
  return getKoreanTranslationText(item.korean_translation) || item.definition?.trim() || ""
}

function buildClips(items: VocabularyItem[], wordTimes: number, meaningTimes: number): Clip[] {
  const clips: Clip[] = []
  items.forEach((item, wordIndex) => {
    const meaning = itemMeaning(item)
    for (let i = 0; i < wordTimes; i++) {
      clips.push({
        itemId: item.id,
        word: item.word,
        meaning,
        kind: "word",
        text: item.word,
        lang: "en",
        wordIndex,
        wordTotal: items.length,
        repeatIndex: i,
        repeatTotal: wordTimes,
      })
    }
    if (meaning) {
      for (let i = 0; i < meaningTimes; i++) {
        clips.push({
          itemId: item.id,
          word: item.word,
          meaning,
          kind: "meaning",
          text: meaning,
          lang: "ko",
          wordIndex,
          wordTotal: items.length,
          repeatIndex: i,
          repeatTotal: meaningTimes,
        })
      }
    }
  })
  return clips
}

export function ListenMode({
  vocabulary,
  listenVocabulary,
}: {
  vocabulary: VocabularyItem[]
  listenVocabulary?: VocabularyItem[]
}) {
  const [state, setState] = useState<ListenState>("idle")
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [wordTimes, setWordTimes] = useState(3)
  const [meaningTimes, setMeaningTimes] = useState(1)
  const [shuffle, setShuffle] = useState(true)
  const [loop, setLoop] = useState(true)
  const [paused, setPaused] = useState(false)
  const [clipIndex, setClipIndex] = useState(0)
  const [clips, setClips] = useState<Clip[]>([])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const keepAliveRef = useRef<HTMLAudioElement | null>(null)
  const clipsRef = useRef<Clip[]>([])
  const clipIndexRef = useRef(0)
  const pausedRef = useRef(false)
  const loopRef = useRef(true)
  const playingRef = useRef(false)
  const blobCacheRef = useRef(new Map<string, string>())
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const sourceVocab = listenVocabulary ?? vocabulary
  const collections = useMemo(
    () => [...new Set(sourceVocab.map((v) => v.collection).filter(Boolean))] as string[],
    [sourceVocab],
  )
  const pool = useMemo(
    () =>
      (selectedCollection ? sourceVocab.filter((v) => v.collection === selectedCollection) : sourceVocab)
        .filter((v) => v.word.trim() && v.type !== "rephrase" && v.type !== "translate"),
    [sourceVocab, selectedCollection],
  )

  const current = clips[clipIndex]

  const ensureAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = "auto"
      audio.setAttribute("playsinline", "true")
      document.body.appendChild(audio)
      audioRef.current = audio
    }
    if (!keepAliveRef.current) {
      const keep = new Audio(SILENT_WAV)
      keep.loop = true
      keep.volume = 0.01
      keep.setAttribute("playsinline", "true")
      document.body.appendChild(keep)
      keepAliveRef.current = keep
    }
    return audioRef.current
  }

  const stopAudio = useCallback(() => {
    playingRef.current = false
    const audio = audioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
    }
    keepAliveRef.current?.pause()
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    if (navigator.mediaSession) {
      navigator.mediaSession.playbackState = "none"
    }
    void wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }, [])

  const updateMediaSession = useCallback((clip: Clip | undefined, isPaused: boolean) => {
    if (!navigator.mediaSession || !clip) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: clip.word,
      artist: clip.meaning || "단어 듣기",
      album: "SurviveEnglish · 단어 듣기",
    })
    navigator.mediaSession.playbackState = isPaused ? "paused" : "playing"
  }, [])

  const playClipAt = useCallback(async (index: number) => {
    const list = clipsRef.current
    if (index >= list.length) {
      if (loopRef.current && list.length > 0) {
        clipIndexRef.current = 0
        setClipIndex(0)
        await playClipAt(0)
        return
      }
      stopAudio()
      setState("idle")
      setPaused(false)
      return
    }

    const clip = list[index]
    clipIndexRef.current = index
    setClipIndex(index)
    updateMediaSession(clip, false)

    const audio = ensureAudio()
    const cacheKey = `${clip.lang}:${clip.text}`
    let url = blobCacheRef.current.get(cacheKey)

    const onDone = () => {
      if (pausedRef.current || !playingRef.current) return
      const next = clipIndexRef.current + 1
      window.setTimeout(() => {
        if (pausedRef.current || !playingRef.current) return
        void playClipAt(next)
      }, clip.kind === "meaning" && clip.repeatIndex + 1 >= clip.repeatTotal ? 700 : 280)
    }

    try {
      if (!url) {
        const res = await fetch(`/api/tts?lang=${clip.lang}&text=${encodeURIComponent(clip.text)}`)
        if (!res.ok) throw new Error("tts")
        const blob = await res.blob()
        if (!blob.size || !blob.type.startsWith("audio")) throw new Error("empty")
        url = URL.createObjectURL(blob)
        blobCacheRef.current.set(cacheKey, url)
      }
      if (pausedRef.current || !playingRef.current) return
      audio.onended = onDone
      audio.onerror = () => { void speakFallback(clip.text, clip.lang).then(onDone) }
      audio.src = url
      await audio.play()
    } catch {
      if (pausedRef.current || !playingRef.current) return
      await speakFallback(clip.text, clip.lang)
      onDone()
    }
  }, [stopAudio, updateMediaSession])

  const start = () => {
    if (pool.length === 0 || wordTimes < 1) return
    const items = shuffle ? [...pool].sort(() => Math.random() - 0.5) : [...pool]
    const nextClips = buildClips(items, wordTimes, meaningTimes)
    if (nextClips.length === 0) return

    clipsRef.current = nextClips
    clipIndexRef.current = 0
    pausedRef.current = false
    loopRef.current = loop
    playingRef.current = true
    setClips(nextClips)
    setClipIndex(0)
    setPaused(false)
    setState("running")

    ensureAudio()
    void keepAliveRef.current?.play().catch(() => {})

    if (navigator.wakeLock) {
      void navigator.wakeLock.request("screen").then((lock) => { wakeLockRef.current = lock }).catch(() => {})
    }

    void playClipAt(0)
  }

  const pause = () => {
    pausedRef.current = true
    setPaused(true)
    audioRef.current?.pause()
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause()
    }
    updateMediaSession(clipsRef.current[clipIndexRef.current], true)
  }

  const resume = () => {
    pausedRef.current = false
    setPaused(false)
    playingRef.current = true
    void keepAliveRef.current?.play().catch(() => {})
    const audio = audioRef.current
    if (audio && audio.src && !audio.ended && audio.paused && audio.currentTime > 0) {
      void audio.play().catch(() => { void playClipAt(clipIndexRef.current) })
    } else {
      void playClipAt(clipIndexRef.current)
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume()
    }
    updateMediaSession(clipsRef.current[clipIndexRef.current], false)
  }

  const skipToWord = (wordIndex: number) => {
    const list = clipsRef.current
    const next = list.findIndex((c) => c.wordIndex === wordIndex)
    if (next < 0) return
    pausedRef.current = false
    setPaused(false)
    playingRef.current = true
    audioRef.current?.pause()
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    void playClipAt(next)
  }

  const stop = () => {
    stopAudio()
    setState("idle")
    setPaused(false)
    setClips([])
    setClipIndex(0)
  }

  useEffect(() => {
    loopRef.current = loop
  }, [loop])

  useEffect(() => {
    if (state !== "running") return
    const onVis = () => {
      if (document.hidden || pausedRef.current || !playingRef.current) return
      const audio = audioRef.current
      if (audio && audio.paused && audio.src) {
        void audio.play().catch(() => { void playClipAt(clipIndexRef.current) })
      }
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [state, playClipAt])

  useEffect(() => {
    if (state !== "running" || !navigator.mediaSession) return
    const session = navigator.mediaSession
    session.setActionHandler("play", () => resume())
    session.setActionHandler("pause", () => pause())
    session.setActionHandler("previoustrack", () => {
      const wordIndex = clipsRef.current[clipIndexRef.current]?.wordIndex ?? 0
      skipToWord(Math.max(0, wordIndex - 1))
    })
    session.setActionHandler("nexttrack", () => {
      const wordIndex = clipsRef.current[clipIndexRef.current]?.wordIndex ?? 0
      skipToWord(wordIndex + 1)
    })
    return () => {
      session.setActionHandler("play", null)
      session.setActionHandler("pause", null)
      session.setActionHandler("previoustrack", null)
      session.setActionHandler("nexttrack", null)
    }
  }, [state])

  useEffect(() => () => {
    stopAudio()
    audioRef.current?.remove()
    keepAliveRef.current?.remove()
    audioRef.current = null
    keepAliveRef.current = null
    for (const url of blobCacheRef.current.values()) URL.revokeObjectURL(url)
    blobCacheRef.current.clear()
  }, [stopAudio])

  if (pool.length === 0 && sourceVocab.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Headphones className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">들을 단어가 없어요</p>
        <p className="text-xs text-muted-foreground/60">단어장에 단어를 추가해 보세요</p>
      </div>
    )
  }

  if (state === "idle") {
    return (
      <div className="flex flex-col items-center gap-5 px-2 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10">
          <Headphones className="h-8 w-8 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <p className="text-lg font-semibold">단어 듣기</p>
          <p className="mt-1 text-sm text-muted-foreground">들으면서 외워요. 화면을 꺼도 이어서 재생돼요.</p>
        </div>

        <CollectionPicker
          collections={collections}
          selectedCollection={selectedCollection}
          onSelect={setSelectedCollection}
        />

        <div className="flex w-full max-w-sm flex-col gap-2">
          <CountStepper label="단어 반복" value={wordTimes} onChange={setWordTimes} min={1} />
          <CountStepper label="뜻 반복" value={meaningTimes} onChange={setMeaningTimes} min={0} />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setShuffle((p) => !p)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
              shuffle
                ? "border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                : "border-border/60 bg-muted/30 text-muted-foreground",
            )}
          >
            랜덤 순서
          </button>
          <button
            type="button"
            onClick={() => setLoop((p) => !p)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
              loop
                ? "border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                : "border-border/60 bg-muted/30 text-muted-foreground",
            )}
          >
            끝까지 반복
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          {pool.length}개 단어 · 단어 {wordTimes}회 · 뜻 {meaningTimes}회
        </p>

        <button
          type="button"
          onClick={start}
          disabled={pool.length === 0}
          className="flex items-center gap-2 rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600/90 disabled:opacity-40"
        >
          <Play className="h-4 w-4 fill-current" />
          듣기 시작
        </button>
      </div>
    )
  }

  const progress = clips.length ? ((clipIndex + 1) / clips.length) * 100 : 0
  const wordIdx = current?.wordIndex ?? 0

  return (
    <div className="flex flex-col gap-5 py-4">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {(current?.wordIndex ?? 0) + 1} / {current?.wordTotal ?? clips.length}
        </span>
      </div>

      <div className="rounded-2xl border border-sky-500/20 bg-card px-5 py-8 text-center shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {current?.kind === "meaning" ? `뜻 ${current.repeatIndex + 1}/${current.repeatTotal}` : `단어 ${current ? current.repeatIndex + 1 : 0}/${current?.repeatTotal ?? wordTimes}`}
        </p>
        <p className="text-3xl font-bold tracking-tight">{current?.word}</p>
        {current?.meaning && (
          <p className={cn(
            "mt-3 text-base leading-relaxed",
            current.kind === "meaning" ? "font-semibold text-foreground" : "text-muted-foreground",
          )}>
            {current.meaning}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => skipToWord(Math.max(0, wordIdx - 1))}
          disabled={wordIdx === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <SkipBack className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => (paused ? resume() : pause())}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm hover:bg-sky-600/90"
        >
          {paused ? <Play className="h-6 w-6 fill-current" /> : <Pause className="h-6 w-6" />}
        </button>
        <button
          type="button"
          onClick={() => skipToWord(wordIdx + 1)}
          disabled={!current || wordIdx + 1 >= current.wordTotal}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <SkipForward className="h-5 w-5" />
        </button>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={stop}
          className="flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Square className="h-3 w-3" />
          종료
        </button>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground/70">
        <Volume2 className="h-3 w-3" />
        잠금 화면에서도 재생 · 이어폰을 빼도 스피커로 나와요
      </p>
    </div>
  )
}
