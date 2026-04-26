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
  const [audioSource, setAudioSource] = useState<"system" | "microphone" | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioBufferRef = useRef<Float32Array[]>([])
  const isRecordingRef = useRef(false)
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Ref to stable stop fn to avoid circular useCallback deps
  const stopRef = useRef<() => void>(() => {})

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

  /** Core recording setup once we have a MediaStream */
  const startFromStream = useCallback(
    (stream: MediaStream, source: "system" | "microphone") => {
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        onError?.("No audio track found. Make sure to check 'Share system audio' when sharing your screen.")
        setStatus("ready")
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      streamRef.current = stream
      isRecordingRef.current = true
      setAudioSource(source)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
      setStatus("recording")

      if (useWebSpeech) {
        startWebSpeech(stream)
        return
      }

      // Set up AudioContext → ScriptProcessor → Whisper worker
      const audioCtx = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioCtx
      const audioOnlyStream = new MediaStream(audioTracks)
      const sourceNode = audioCtx.createMediaStreamSource(audioOnlyStream)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return
        audioBufferRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      }

      sourceNode.connect(processor)
      processor.connect(audioCtx.destination)
      chunkIntervalRef.current = setInterval(processAudioChunk, 5000)

      // Stop when user ends screen share from browser UI
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (isRecordingRef.current) stopRef.current()
      })
      // Also stop when any audio track ends (microphone disconnect, etc.)
      stream.getAudioTracks()[0]?.addEventListener("ended", () => {
        if (isRecordingRef.current) stopRef.current()
      })
    },
    [useWebSpeech, startWebSpeech, processAudioChunk, onError, stopRef]
  )

  const start = useCallback(async () => {
    setStatus("loading_model")
    // 1) Try system audio capture via getDisplayMedia
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 16000,
        },
      })
      startFromStream(stream, "system")
      return
    } catch (displayErr: unknown) {
      const msg = displayErr instanceof Error ? displayErr.message : String(displayErr)
      const isPermissionsPolicyError =
        msg.toLowerCase().includes("permissions policy") ||
        msg.toLowerCase().includes("disallowed") ||
        msg.toLowerCase().includes("not allowed") ||
        msg.toLowerCase().includes("notallowederror")
      const isExplicitDeny = msg.toLowerCase().includes("permission denied") || msg.toLowerCase().includes("dismissed")

      if (isExplicitDeny) {
        // User actively cancelled the screen picker — don't fall back silently
        onError?.("Screen share cancelled. Click Start to try again.")
        setStatus("ready")
        return
      }

      if (!isPermissionsPolicyError) {
        // Unexpected error — surface it
        onError?.(msg)
        setStatus("ready")
        return
      }

      // Permissions policy blocked getDisplayMedia (e.g. inside an iframe / v0 preview)
      // Fall back to microphone automatically
    }

    // 2) Fall back to microphone via getUserMedia
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      })
      startFromStream(stream, "microphone")
    } catch (micErr: unknown) {
      const msg = micErr instanceof Error ? micErr.message : String(micErr)
      onError?.(
        msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")
          ? "Microphone permission denied. Please allow microphone access and try again."
          : msg
      )
      setStatus("ready")
    }
  }, [startFromStream, onError])

  const stop: () => void = useCallback(() => {
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

  // Keep stopRef current
  stopRef.current = stop

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
    audioSource,
    start,
    stop,
    reset,
    setTranscript,
  }
}
