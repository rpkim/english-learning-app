"use client"

import { useRef, useState, useCallback, useEffect } from "react"

export type TranscriptionStatus =
  | "idle"
  | "loading_model"
  | "ready"
  | "recording"
  | "error"

// Local type declarations for Web Speech API (not in all TS DOM libs)
interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLocal) => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionResultEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEventLocal {
  error: string
}

interface AnyWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance
}

interface UseTranscriptionOptions {
  onTranscript?: (text: string) => void
  onError?: (msg: string) => void
}

/**
 * useTranscription — captures computer audio output via getDisplayMedia
 * and transcribes using Whisper Tiny (local, open-source) via a Web Worker.
 *
 * Falls back to Web Speech API if WebWorker/WASM is unavailable.
 */
export function useTranscription({ onTranscript, onError }: UseTranscriptionOptions = {}) {
  const [status, setStatus] = useState<TranscriptionStatus>("idle")
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingFile, setLoadingFile] = useState("")
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [duration, setDuration] = useState(0)
  const [useWebSpeech, setUseWebSpeech] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioBufferRef = useRef<Float32Array[]>([])
  const isRecordingRef = useRef(false)
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const isRecording = status === "recording"

  // Initialize the Whisper Web Worker
  const initWorker = useCallback(() => {
    if (workerRef.current) return
    try {
      const worker = new Worker("/whisper-worker.js", { type: "module" })
      worker.onmessage = (e) => {
        const { type, message, progress, file, text } = e.data
        if (type === "loading") {
          setStatus("loading_model")
        } else if (type === "loading_progress") {
          setLoadingProgress(progress ?? 0)
          setLoadingFile(file ?? "")
        } else if (type === "ready") {
          setStatus("ready")
        } else if (type === "result" && text) {
          const clean = text.trim()
          if (clean && clean !== "[BLANK_AUDIO]") {
            setTranscript((prev) => prev + (prev ? " " : "") + clean)
            setInterimTranscript("")
            onTranscript?.(clean)
          }
        } else if (type === "error") {
          onError?.(message)
        }
      }
      worker.onerror = () => {
        setUseWebSpeech(true)
        setStatus("ready")
      }
      workerRef.current = worker
      worker.postMessage({ type: "load" })
    } catch {
      setUseWebSpeech(true)
      setStatus("ready")
    }
  }, [onTranscript, onError])

  // Web Speech API fallback
  const startWebSpeech = useCallback((stream: MediaStream) => {
    const win = window as AnyWindow
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SR) {
      onError?.("Speech recognition not supported in this browser.")
      setStatus("error")
      return
    }
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (e: SpeechRecognitionResultEvent) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) {
          const text = res[0].transcript
          setTranscript((prev) => prev + (prev ? " " : "") + text.trim())
          setInterimTranscript("")
          onTranscript?.(text.trim())
        } else {
          interim += res[0].transcript
        }
      }
      setInterimTranscript(interim)
    }
    recognition.onerror = (e: SpeechRecognitionErrorEventLocal) => {
      if (e.error !== "aborted") onError?.(`Speech recognition error: ${e.error}`)
    }
    recognition.start()
    recognitionRef.current = recognition
    // keep stream alive (not used directly but prevents GC)
    streamRef.current = stream
  }, [onTranscript, onError])

  // Process accumulated audio buffer through Whisper
  const processAudioChunk = useCallback(() => {
    if (!workerRef.current || audioBufferRef.current.length === 0) return
    const totalLength = audioBufferRef.current.reduce((sum, buf) => sum + buf.length, 0)
    const combined = new Float32Array(totalLength)
    let offset = 0
    for (const buf of audioBufferRef.current) {
      combined.set(buf, offset)
      offset += buf.length
    }
    audioBufferRef.current = []
    workerRef.current.postMessage({ type: "transcribe", audio: combined }, [combined.buffer])
  }, [])

  const start = useCallback(async () => {
    try {
      setStatus("loading_model")
      // Capture system audio via screen share (show entire screen, audio only matters)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 16000,
        },
      })

      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        onError?.("No audio track found. Make sure to check 'Share system audio' when sharing your screen.")
        setStatus("ready")
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      streamRef.current = stream
      isRecordingRef.current = true
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
      setStatus("recording")

      if (useWebSpeech) {
        startWebSpeech(stream)
        return
      }

      // Set up AudioContext to pipe audio to ScriptProcessor → Whisper worker
      const audioCtx = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioCtx
      const audioOnlyStream = new MediaStream(audioTracks)
      const source = audioCtx.createMediaStreamSource(audioOnlyStream)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return
        const inputData = e.inputBuffer.getChannelData(0)
        audioBufferRef.current.push(new Float32Array(inputData))
      }

      source.connect(processor)
      processor.connect(audioCtx.destination)

      // Send audio to Whisper every 5 seconds
      chunkIntervalRef.current = setInterval(processAudioChunk, 5000)

      // Stop when user stops screen share
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (isRecordingRef.current) stop()
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      onError?.(msg.includes("Permission denied") ? "Screen share permission denied." : msg)
      setStatus("ready")
    }
  }, [useWebSpeech, startWebSpeech, processAudioChunk, onError])

  const stop = useCallback(() => {
    isRecordingRef.current = false

    // Process any remaining audio
    if (!useWebSpeech) processAudioChunk()

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current)
    if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current)

    // Stop stream
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    // Cleanup audio context
    processorRef.current?.disconnect()
    audioContextRef.current?.close()
    audioContextRef.current = null
    processorRef.current = null

    // Stop Web Speech
    recognitionRef.current?.stop()
    recognitionRef.current = null

    setInterimTranscript("")
    setStatus("ready")
  }, [useWebSpeech, processAudioChunk])

  const reset = useCallback(() => {
    setTranscript("")
    setInterimTranscript("")
    setDuration(0)
  }, [])

  // Auto-init worker on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check if Worker + module type is supported
      try {
        initWorker()
      } catch {
        setUseWebSpeech(true)
        setStatus("ready")
      }
    }
    return () => {
      workerRef.current?.terminate()
      if (timerRef.current) clearInterval(timerRef.current)
      if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current)
    }
  }, [initWorker])

  return {
    status,
    loadingProgress,
    loadingFile,
    transcript,
    interimTranscript,
    isRecording,
    duration,
    start,
    stop,
    reset,
    setTranscript,
  }
}
