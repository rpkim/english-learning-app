"use client"

import { useRef, useState, useCallback, useEffect } from "react"

export type TranscriptionStatus =
  | "idle"
  | "loading_model"
  | "ready"
  | "recording"
  | "error"

export type AudioInputSource = "system" | "microphone"

export interface TranscriptionDebugInfo {
  framesCaptured: number
  chunksSent: number
  audioLevel: number
  workerState: "idle" | "loading" | "ready" | "error"
  lastWorkerError: string | null
}

export interface TranscriptionUtterance {
  id: string
  text: string
  source: "whisper" | "webspeech"
  ts: number
}

function isElectronDesktop() {
  if (typeof window === "undefined") return false
  const maybeDesktop = (window as Window & { desktop?: { isElectron?: boolean } }).desktop
  return Boolean(maybeDesktop?.isElectron)
}

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
  whisperModel?: "tiny" | "base" | "small" | "medium"
}

const TARGET_SAMPLE_RATE = 16000

function getMaxBacklogSamples(model: "tiny" | "base" | "small" | "medium") {
  const secondsByModel: Record<"tiny" | "base" | "small" | "medium", number> = {
    tiny: 12,
    base: 10,
    small: 8,
    medium: 6,
  }
  return TARGET_SAMPLE_RATE * secondsByModel[model]
}

function isOrtRunFailure(message: string | null | undefined) {
  const msg = String(message ?? "").toLowerCase()
  return msg.includes("ortrun") || msg.includes("error code = 6") || msg.includes("onnxruntime")
}

function isInvalidSessionIdError(message: string | null | undefined) {
  return String(message ?? "").toLowerCase().includes("invalid session id")
}

function hasWebSpeechSupport() {
  if (typeof window === "undefined") return false
  const win = window as AnyWindow
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition)
}

/**
 * useTranscription — captures computer audio output via getDisplayMedia
 * and transcribes using Whisper Tiny (local, open-source) via a Web Worker.
 *
 * Falls back to Web Speech API if WebWorker/WASM is unavailable.
 */
export function useTranscription({ onTranscript, onError, whisperModel = "tiny" }: UseTranscriptionOptions = {}) {
  const [status, setStatus] = useState<TranscriptionStatus>("idle")
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingFile, setLoadingFile] = useState("")
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [duration, setDuration] = useState(0)
  const [useWebSpeech, setUseWebSpeech] = useState(false)
  const [audioSource, setAudioSource] = useState<"system" | "microphone" | null>(null)
  const [debugInfo, setDebugInfo] = useState<TranscriptionDebugInfo>({
    framesCaptured: 0,
    chunksSent: 0,
    audioLevel: 0,
    workerState: "idle",
    lastWorkerError: null,
  })
  const [utterances, setUtterances] = useState<TranscriptionUtterance[]>([])
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null)
  const [isRefining, setIsRefining] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioBufferRef = useRef<Float32Array[]>([])
  const inputSampleRateRef = useRef(16000)
  const whisperModelRef = useRef<"tiny" | "base" | "small" | "medium">(whisperModel)
  const startedAtRef = useRef<number>(0)
  const audioFrameCountRef = useRef(0)
  const noAudioWarnTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRecordingRef = useRef(false)
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const workerReadyRef = useRef(false)
  const workerBusyRef = useRef(false)
  const workerReadyWaitersRef = useRef<Array<() => void>>([])
  const lastRecoveryNoticeAtRef = useRef(0)
  const transcribeRequestRef = useRef<{
    resolve: (text: string) => void
    reject: (message: string) => void
  } | null>(null)
  // Ref to stable stop fn to avoid circular useCallback deps
  const stopRef = useRef<() => void>(() => {})

  const isRecording = status === "recording"

  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onErrorRef.current = onError
  }, [onTranscript, onError])

  // Initialize the Whisper Web Worker
  const initWorker = useCallback(() => {
    if (workerRef.current) return
    try {
      const worker = new Worker("/whisper-worker.js", { type: "module" })
      worker.onmessage = (e) => {
        const { type, message, progress, file, text } = e.data
        if (type === "loading") {
          workerReadyRef.current = false
          setDebugInfo((prev) => ({ ...prev, workerState: "loading" }))
          setStatus("loading_model")
        } else if (type === "loading_progress") {
          setLoadingProgress(progress ?? 0)
          setLoadingFile(file ?? "")
        } else if (type === "ready") {
          workerReadyRef.current = true
          if (workerReadyWaitersRef.current.length > 0) {
            for (const resolve of workerReadyWaitersRef.current) resolve()
            workerReadyWaitersRef.current = []
          }
          setDebugInfo((prev) => ({ ...prev, workerState: "ready", lastWorkerError: null }))
          setStatus("ready")
        } else if (type === "result" && text) {
          workerBusyRef.current = false
          if (transcribeRequestRef.current) {
            transcribeRequestRef.current.resolve(String(text ?? ""))
            transcribeRequestRef.current = null
            return
          }
          const clean = text.trim()
          if (clean && clean !== "[BLANK_AUDIO]") {
            setUtterances((prev) => [...prev, { id: crypto.randomUUID(), text: clean, source: "whisper", ts: Date.now() }])
            setTranscript((prev) => appendNonDuplicateTranscript(prev, clean))
            setInterimTranscript("")
            onTranscriptRef.current?.(clean)
          }
        } else if (type === "error") {
          workerBusyRef.current = false
          if (transcribeRequestRef.current) {
            transcribeRequestRef.current.reject(message ?? "Unknown worker error")
            transcribeRequestRef.current = null
          }
          const isOrtFailure = isOrtRunFailure(message)
          if (isOrtFailure && workerRef.current) {
            const now = Date.now()
            const shouldNotify = now - lastRecoveryNoticeAtRef.current > 10_000
            if (whisperModelRef.current !== "tiny") {
              whisperModelRef.current = "tiny"
              workerReadyRef.current = false
              setDebugInfo((prev) => ({
                ...prev,
                workerState: "loading",
                lastWorkerError: message ?? "Whisper runtime error",
              }))
              setStatus("loading_model")
              workerRef.current.postMessage({ type: "load", model: "tiny" })
              if (shouldNotify) {
                lastRecoveryNoticeAtRef.current = now
                onErrorRef.current?.("Whisper runtime limit reached. Automatically switching to Tiny model for stability.")
              }
              return
            }
          }
          setDebugInfo((prev) => ({ ...prev, workerState: "error", lastWorkerError: message ?? "Unknown worker error" }))
          onErrorRef.current?.(message)
        }
      }
      worker.onerror = () => {
        workerBusyRef.current = false
        if (transcribeRequestRef.current) {
          transcribeRequestRef.current.reject("Worker runtime error")
          transcribeRequestRef.current = null
        }
        workerReadyRef.current = false
        setDebugInfo((prev) => ({ ...prev, workerState: "error", lastWorkerError: "Worker runtime error" }))
        if (hasWebSpeechSupport()) {
          setUseWebSpeech(true)
        } else {
          setStatus("error")
          onErrorRef.current?.("Real-time transcription is not supported in this browser. Please use latest Chrome.")
          return
        }
        setStatus("ready")
      }
      workerRef.current = worker
      worker.postMessage({ type: "load", model: whisperModelRef.current })
    } catch {
      workerReadyRef.current = false
      if (hasWebSpeechSupport()) {
        setUseWebSpeech(true)
      } else {
        setStatus("error")
        onErrorRef.current?.("Real-time transcription is not supported in this browser. Please use latest Chrome.")
        return
      }
      setStatus("ready")
    }
  }, [])

  useEffect(() => {
    whisperModelRef.current = whisperModel
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
      workerReadyRef.current = false
      setDebugInfo((prev) => ({ ...prev, workerState: "idle" }))
    }
    initWorker()
  }, [whisperModel, initWorker])

  // Web Speech API fallback
  const startWebSpeech = useCallback((stream: MediaStream) => {
    const win = window as AnyWindow
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SR) {
      onErrorRef.current?.("Speech recognition not supported in this browser.")
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
          const clean = text.trim()
          if (clean) {
            setUtterances((prev) => [...prev, { id: crypto.randomUUID(), text: clean, source: "webspeech", ts: Date.now() }])
          }
          setTranscript((prev) => prev + (prev ? " " : "") + text.trim())
          setInterimTranscript("")
          onTranscriptRef.current?.(text.trim())
        } else {
          interim += res[0].transcript
        }
      }
      setInterimTranscript(interim)
    }
    recognition.onerror = (e: SpeechRecognitionErrorEventLocal) => {
      if (e.error !== "aborted") onErrorRef.current?.(`Speech recognition error: ${e.error}`)
    }
    recognition.start()
    recognitionRef.current = recognition
    // keep stream alive (not used directly but prevents GC)
    streamRef.current = stream
  }, [])

  // Process accumulated audio buffer through Whisper
  const processAudioChunk = useCallback(() => {
    if (!workerRef.current || audioBufferRef.current.length === 0) return
    // Don't flush buffered audio until the Whisper model is ready.
    if (!workerReadyRef.current) return
    // If worker is still processing previous chunk, keep buffering but trim backlog.
    if (workerBusyRef.current) {
      const maxBacklogSamples = getMaxBacklogSamples(whisperModelRef.current)
      const totalLength = audioBufferRef.current.reduce((sum, buf) => sum + buf.length, 0)
      if (totalLength > maxBacklogSamples) {
        const all = new Float32Array(totalLength)
        let o = 0
        for (const b of audioBufferRef.current) {
          all.set(b, o)
          o += b.length
        }
        const trimmed = all.slice(all.length - maxBacklogSamples)
        audioBufferRef.current = [trimmed]
      }
      return
    }
    const totalLength = audioBufferRef.current.reduce((sum, buf) => sum + buf.length, 0)
    const combined = new Float32Array(totalLength)
    let offset = 0
    for (const buf of audioBufferRef.current) {
      combined.set(buf, offset)
      offset += buf.length
    }
    audioBufferRef.current = []

    const inputRate = inputSampleRateRef.current
    // Whisper works best with 16kHz mono PCM input.
    const preparedAudio =
      inputRate === TARGET_SAMPLE_RATE
        ? combined
        : downsampleTo16kHz(combined, inputRate)

    const maxBacklogSamples = getMaxBacklogSamples(whisperModelRef.current)
    const limitedAudio =
      preparedAudio.length > maxBacklogSamples
        ? preparedAudio.slice(preparedAudio.length - maxBacklogSamples)
        : preparedAudio

    workerBusyRef.current = true
    workerRef.current.postMessage(
      { type: "transcribe", audio: limitedAudio, samplingRate: TARGET_SAMPLE_RATE, model: whisperModelRef.current },
      [limitedAudio.buffer]
    )
    setDebugInfo((prev) => ({ ...prev, chunksSent: prev.chunksSent + 1 }))
  }, [])

  const waitForWorkerReady = useCallback(async () => {
    if (workerReadyRef.current) return
    await new Promise<void>((resolve) => {
      workerReadyWaitersRef.current.push(resolve)
    })
  }, [])

  /** Core recording setup once we have a MediaStream */
  const startFromStream = useCallback(
    (stream: MediaStream, source: "system" | "microphone") => {
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        onErrorRef.current?.("No audio track found. Make sure to check 'Share system audio' when sharing your screen.")
        setStatus("ready")
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      streamRef.current = stream
      // Ensure a fresh pipeline when restarting recording.
      audioBufferRef.current = []
      workerBusyRef.current = false
      transcribeRequestRef.current = null
      recordedChunksRef.current = []
      setRecordedAudioBlob(null)
      isRecordingRef.current = true
      setAudioSource(source)
      setUtterances([])
      setDuration(0)
      startedAtRef.current = Date.now()
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000)
        setDuration(elapsed)
      }, 250)
      setStatus("recording")
      audioFrameCountRef.current = 0
      setDebugInfo((prev) => ({
        ...prev,
        framesCaptured: 0,
        chunksSent: 0,
        audioLevel: 0,
        lastWorkerError: null,
      }))

      if (noAudioWarnTimeoutRef.current) clearTimeout(noAudioWarnTimeoutRef.current)
      noAudioWarnTimeoutRef.current = setTimeout(() => {
        if (isRecordingRef.current && audioFrameCountRef.current === 0) {
          onErrorRef.current?.("Audio signal not detected from the shared source. Try re-sharing the tab with tab audio enabled.")
        }
      }, 3000)

      try {
        if (typeof MediaRecorder !== "undefined") {
          const recordingStream = new MediaStream(audioTracks)
          const recorder = new MediaRecorder(recordingStream)
          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              recordedChunksRef.current.push(event.data)
            }
          }
          recorder.onstop = () => {
            if (recordedChunksRef.current.length === 0) return
            const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" })
            setRecordedAudioBlob(blob)
          }
          recorder.start(1000)
          mediaRecorderRef.current = recorder
        }
      } catch {
        mediaRecorderRef.current = null
      }

      if (useWebSpeech) {
        startWebSpeech(stream)
        return
      }

      // Set up AudioContext → ScriptProcessor → Whisper worker
      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx
      inputSampleRateRef.current = audioCtx.sampleRate
      const audioOnlyStream = new MediaStream(audioTracks)
      const sourceNode = audioCtx.createMediaStreamSource(audioOnlyStream)
      const processor = audioCtx.createScriptProcessor(4096, 2, 1)
      processorRef.current = processor
      const silentGain = audioCtx.createGain()
      silentGain.gain.value = 0

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return
        audioFrameCountRef.current += e.inputBuffer.length
        const input = e.inputBuffer
        const channels = input.numberOfChannels
        const frames = input.length
        const mono = new Float32Array(frames)

        if (channels <= 1) {
          mono.set(input.getChannelData(0))
        } else {
          // Mix all input channels to mono for stable ASR input.
          for (let ch = 0; ch < channels; ch++) {
            const channelData = input.getChannelData(ch)
            for (let i = 0; i < frames; i++) {
              mono[i] += channelData[i]
            }
          }
          for (let i = 0; i < frames; i++) {
            mono[i] /= channels
          }
        }

        let peak = 0
        for (let i = 0; i < frames; i++) {
          const abs = Math.abs(mono[i])
          if (abs > peak) peak = abs
        }
        setDebugInfo((prev) => ({
          ...prev,
          framesCaptured: audioFrameCountRef.current,
          audioLevel: peak,
        }))

        audioBufferRef.current.push(mono)
      }

      sourceNode.connect(processor)
      processor.connect(silentGain)
      silentGain.connect(audioCtx.destination)

      // Some browsers start AudioContext in "suspended" state even after
      // permission prompts; resuming here ensures onaudioprocess actually fires.
      void audioCtx.resume().catch(() => {})
      chunkIntervalRef.current = setInterval(processAudioChunk, 1000)

      // Stop when user ends screen share from browser UI
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (isRecordingRef.current) stopRef.current()
      })
      // Also stop when any audio track ends (microphone disconnect, etc.)
      stream.getAudioTracks()[0]?.addEventListener("ended", () => {
        if (isRecordingRef.current) stopRef.current()
      })
    },
    [useWebSpeech, startWebSpeech, processAudioChunk, stopRef]
  )

  const start = useCallback(async (preferredSource: AudioInputSource = "system") => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onErrorRef.current?.("Media capture is not supported in this browser. Please use latest Chrome.")
      setStatus("error")
      return
    }

    if (!useWebSpeech && !workerReadyRef.current) {
      setStatus("loading_model")
    }
    if (preferredSource === "system") {
      if (!navigator.mediaDevices.getDisplayMedia) {
        onErrorRef.current?.("System audio capture is not supported in this browser.")
        setStatus("ready")
        return
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 16000,
          },
        })
        if (stream.getAudioTracks().length === 0) {
          stream.getTracks().forEach((t) => t.stop())
          if (isElectronDesktop()) {
            onErrorRef.current?.("No system audio track found. In Electron, choose Entire Screen with system audio enabled. Switched to microphone for now.")
          } else {
            onErrorRef.current?.("No system audio track found. Re-share with tab/system audio enabled.")
            setStatus("ready")
            return
          }
        }
        if (stream.getAudioTracks().length > 0) {
          startFromStream(stream, "system")
          return
        }
      } catch (displayErr: unknown) {
        const msg = displayErr instanceof Error ? displayErr.message : String(displayErr)
        const isExplicitDeny = msg.toLowerCase().includes("permission denied") || msg.toLowerCase().includes("dismissed")
        onErrorRef.current?.(isExplicitDeny ? "Screen share cancelled. Click Start to try again." : msg)
        setStatus("ready")
        return
      }
    }

    // Microphone mode
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
      onErrorRef.current?.(
        msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")
          ? "Microphone permission denied. Please allow microphone access and try again."
          : msg
      )
      setStatus("ready")
    }
  }, [startFromStream, useWebSpeech])

  const stop: () => void = useCallback(() => {
    isRecordingRef.current = false

    // Process any remaining audio
    if (!useWebSpeech) processAudioChunk()

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current)
    if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current)
    if (noAudioWarnTimeoutRef.current) clearTimeout(noAudioWarnTimeoutRef.current)
    timerRef.current = null
    chunkIntervalRef.current = null
    noAudioWarnTimeoutRef.current = null

    // Stop stream
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    // Finalize recording blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null

    // Cleanup audio context
    processorRef.current?.disconnect()
    audioContextRef.current?.close()
    audioContextRef.current = null
    processorRef.current = null

    // Stop Web Speech
    recognitionRef.current?.stop()
    recognitionRef.current = null

    // Clear leftover buffers and pending worker state before next start.
    audioBufferRef.current = []
    workerBusyRef.current = false
    transcribeRequestRef.current = null
    setInterimTranscript("")
    setStatus("ready")
  }, [useWebSpeech, processAudioChunk])

  // Keep stopRef current
  stopRef.current = stop

  const reset = useCallback(() => {
    setTranscript("")
    setInterimTranscript("")
    setDuration(0)
    setUtterances([])
    setRecordedAudioBlob(null)
    recordedChunksRef.current = []
  }, [])

  const refineTranscript = useCallback(async (model: "tiny" | "base" | "small" | "medium" = "small") => {
    if (isRecordingRef.current) {
      throw new Error("Stop recording before refining transcript")
    }
    if (!recordedAudioBlob) {
      throw new Error("No recorded audio available for refinement")
    }
    if (!workerRef.current) {
      throw new Error("Transcription worker is not ready")
    }

    setIsRefining(true)
    try {
      workerRef.current.postMessage({ type: "load", model })
      await waitForWorkerReady()

      const audioBuffer = await blobToAudioBuffer(recordedAudioBlob)
      const mono = mixToMono(audioBuffer)
      const prepared = audioBuffer.sampleRate === TARGET_SAMPLE_RATE
        ? normalizeAudio(mono)
        : downsampleTo16kHz(mono, audioBuffer.sampleRate)

      const chunkSamples = TARGET_SAMPLE_RATE * 10
      const strideSamples = TARGET_SAMPLE_RATE * 9
      let nextTranscript = ""
      const runSegment = async (segment: Float32Array) => {
        let lastError = "Failed to transcribe segment"
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const segmentCopy = segment.slice(0)
            const resultPromise = new Promise<string>((resolve, reject) => {
              transcribeRequestRef.current = { resolve, reject }
              workerBusyRef.current = true
              workerRef.current?.postMessage(
                { type: "transcribe", audio: segmentCopy, samplingRate: TARGET_SAMPLE_RATE, model },
                [segmentCopy.buffer]
              )
            })
            return await resultPromise
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error)
            if (attempt === 0 && isInvalidSessionIdError(lastError) && workerRef.current) {
              workerReadyRef.current = false
              workerRef.current.postMessage({ type: "load", model })
              await waitForWorkerReady()
              continue
            }
            throw new Error(lastError)
          }
        }
        throw new Error(lastError)
      }

      for (let start = 0; start < prepared.length; start += strideSamples) {
        const end = Math.min(prepared.length, start + chunkSamples)
        const segment = prepared.slice(start, end)
        if (segment.length < TARGET_SAMPLE_RATE) break
        const text = (await runSegment(segment)).trim()
        if (text && text !== "[BLANK_AUDIO]") {
          nextTranscript = appendNonDuplicateTranscript(nextTranscript, text)
        }
      }

      if (nextTranscript.trim()) {
        setTranscript(nextTranscript.trim())
      }
      return nextTranscript.trim()
    } finally {
      setIsRefining(false)
    }
  }, [recordedAudioBlob, waitForWorkerReady])

  const downloadRecording = useCallback(() => {
    if (!recordedAudioBlob) return
    const url = URL.createObjectURL(recordedAudioBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = `surviveenglish-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [recordedAudioBlob])

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
      workerRef.current = null
      workerReadyRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current)
      if (noAudioWarnTimeoutRef.current) clearTimeout(noAudioWarnTimeoutRef.current)
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
    debugInfo,
    utterances,
    recordedAudioBlob,
    isRefining,
    start,
    stop,
    reset,
    refineTranscript,
    downloadRecording,
    setTranscript,
  }
}

async function blobToAudioBuffer(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext()
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
    return decoded
  } finally {
    await audioCtx.close().catch(() => {})
  }
}

function mixToMono(buffer: AudioBuffer) {
  const frames = buffer.length
  const channels = buffer.numberOfChannels
  const mono = new Float32Array(frames)
  if (channels <= 1) {
    mono.set(buffer.getChannelData(0))
    return mono
  }
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < frames; i++) mono[i] += data[i]
  }
  for (let i = 0; i < frames; i++) mono[i] /= channels
  return mono
}

function downsampleTo16kHz(buffer: Float32Array, inputSampleRate: number) {
  if (!Number.isFinite(inputSampleRate) || inputSampleRate <= TARGET_SAMPLE_RATE) {
    return buffer
  }

  const ratio = inputSampleRate / TARGET_SAMPLE_RATE
  const newLength = Math.max(1, Math.round(buffer.length / ratio))
  const output = new Float32Array(newLength)

  let inIndex = 0
  for (let outIndex = 0; outIndex < newLength; outIndex++) {
    const nextInIndex = Math.round((outIndex + 1) * ratio)
    let sum = 0
    let count = 0
    for (let i = inIndex; i < nextInIndex && i < buffer.length; i++) {
      sum += buffer[i]
      count++
    }
    output[outIndex] = count > 0 ? sum / count : 0
    inIndex = nextInIndex
  }

  return normalizeAudio(output)
}

function normalizeAudio(buffer: Float32Array) {
  let sumSquares = 0
  for (let i = 0; i < buffer.length; i++) {
    sumSquares += buffer[i] * buffer[i]
  }
  const rms = Math.sqrt(sumSquares / Math.max(1, buffer.length))
  if (!Number.isFinite(rms) || rms < 1e-4) return buffer

  const targetRms = 0.08
  const gain = Math.min(8, targetRms / rms)
  if (gain <= 1.05) return buffer

  const normalized = new Float32Array(buffer.length)
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i] * gain
    normalized[i] = Math.max(-1, Math.min(1, v))
  }
  return normalized
}

function appendNonDuplicateTranscript(previous: string, incoming: string) {
  const prev = previous.trim()
  const next = incoming.trim()
  if (!next) return previous
  if (!prev) return next

  const prevLower = prev.toLowerCase()
  const nextLower = next.toLowerCase()

  // Drop exact duplicate chunks.
  if (prevLower.endsWith(nextLower)) return previous

  // If incoming starts with tail of previous, append only non-overlapping suffix.
  const maxOverlap = Math.min(nextLower.length, 80)
  for (let overlap = maxOverlap; overlap >= 12; overlap--) {
    const prevTail = prevLower.slice(-overlap)
    const nextHead = nextLower.slice(0, overlap)
    if (prevTail === nextHead) {
      return `${previous} ${next.slice(overlap).trim()}`.trim()
    }
  }

  // Guard against repetitive short phrase spam (e.g., "a little bit of" loop).
  const shortPhrase = nextLower.split(/\s+/).slice(0, 6).join(" ").trim()
  if (shortPhrase.length >= 8) {
    const tail = prevLower.slice(-300)
    const count = tail.split(shortPhrase).length - 1
    if (count >= 3) return previous
  }

  return `${previous} ${next}`.trim()
}
