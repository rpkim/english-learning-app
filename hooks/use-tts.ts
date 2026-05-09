"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Thin wrapper around the browser's Web Speech API (speechSynthesis).
 * Free, offline, no API key required.
 *
 * - Automatically picks an English (en-US) voice when available.
 * - Calling speak() with the same text while it's playing will stop it (toggle).
 * - Any new speak() cancels the previous utterance first.
 */
export function useTts() {
  const [speakingText, setSpeakingText] = useState<string | null>(null)
  const currentRef = useRef<string | null>(null)

  const applyEnglishVoice = (utterance: SpeechSynthesisUtterance) => {
    const voices = window.speechSynthesis.getVoices()
    const voice =
      voices.find((v) => v.lang === "en-US" && /samantha|karen|moira/i.test(v.name)) ||
      voices.find((v) => v.lang === "en-US") ||
      voices.find((v) => v.lang.startsWith("en"))
    if (voice) utterance.voice = voice
  }

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return

    // Toggle off if the same text is already playing
    if (currentRef.current === text) {
      window.speechSynthesis.cancel()
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    utterance.rate = 0.85
    utterance.pitch = 1

    if (window.speechSynthesis.getVoices().length > 0) {
      applyEnglishVoice(utterance)
    } else {
      window.speechSynthesis.addEventListener("voiceschanged", () => applyEnglishVoice(utterance), { once: true })
    }

    utterance.onstart = () => {
      currentRef.current = text
      setSpeakingText(text)
    }
    utterance.onend = () => {
      if (currentRef.current === text) {
        currentRef.current = null
        setSpeakingText(null)
      }
    }
    utterance.onerror = () => {
      currentRef.current = null
      setSpeakingText(null)
    }

    window.speechSynthesis.speak(utterance)
  }, [])

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      currentRef.current = null
      setSpeakingText(null)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return { speak, cancel, speakingText }
}
