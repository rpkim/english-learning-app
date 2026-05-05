/**
 * Local ASR Web Worker using @xenova/transformers (ONNX in the browser).
 * Whisper (OpenAI) and Wav2Vec2 (Meta) presets — no API key.
 */

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js"

env.allowLocalModels = false
env.useBrowserCache = true

let transcriber = null
let loadedModelId = null

const LEGACY_WHISPER = {
  tiny: "whisper-tiny",
  base: "whisper-base",
  small: "whisper-small",
  medium: "whisper-small",
}

const MODEL_PRESETS = {
  /** Distilled Whisper — fewer layers than Whisper, often faster than Base at stronger WER (English). */
  "distil-whisper-small-en": { hf: "distil-whisper/distil-small.en", kind: "whisper" },
  "whisper-tiny": { hf: "Xenova/whisper-tiny.en", kind: "whisper" },
  "whisper-base": { hf: "Xenova/whisper-base.en", kind: "whisper" },
  "whisper-small": { hf: "Xenova/whisper-small.en", kind: "whisper" },
  "wav2vec2-base-960h": { hf: "Xenova/wav2vec2-base-960h", kind: "ctc" },
  "wav2vec2-large-xlsr-53-en": { hf: "Xenova/wav2vec2-large-xlsr-53-english", kind: "ctc" },
}

function normalizeModelKey(model) {
  if (typeof model !== "string") return "whisper-tiny"
  if (MODEL_PRESETS[model]) return model
  if (LEGACY_WHISPER[model]) return LEGACY_WHISPER[model]
  return "whisper-tiny"
}

async function loadModel(modelKey) {
  const key = normalizeModelKey(modelKey)
  const preset = MODEL_PRESETS[key]
  const modelId = preset.hf
  if (transcriber && loadedModelId === modelId) {
    self.postMessage({ type: "ready" })
    return
  }

  if (transcriber && typeof transcriber.dispose === "function") {
    try {
      await transcriber.dispose()
    } catch {}
  }

  self.postMessage({ type: "loading", message: "Downloading speech model (first run only)..." })
  transcriber = await pipeline("automatic-speech-recognition", modelId, {
    progress_callback: (p) => {
      if (p.status === "progress") {
        self.postMessage({
          type: "loading_progress",
          progress: Math.round(p.progress),
          file: p.file,
        })
      }
    },
  })
  loadedModelId = modelId
  self.postMessage({ type: "ready" })
}

self.addEventListener("message", async (event) => {
  const { type, audio, samplingRate, model } = event.data

  if (type === "load") {
    await loadModel(event.data.model)
    return
  }

  if (type === "transcribe") {
    if (!transcriber) {
      self.postMessage({ type: "error", message: "Model not loaded" })
      return
    }
    try {
      const effectiveKey = normalizeModelKey(model)
      const preset = MODEL_PRESETS[effectiveKey]
      const isWhisper = preset.kind === "whisper"
      const isLargeWhisper = effectiveKey === "whisper-small"
      const chunkLengthS = isLargeWhisper ? 4 : 5
      const sr = typeof samplingRate === "number" ? samplingRate : 16000

      const opts = isWhisper
        ? {
            sampling_rate: sr,
            chunk_length_s: chunkLengthS,
            stride_length_s: 1,
            return_timestamps: false,
          }
        : {
            sampling_rate: sr,
            return_timestamps: false,
          }

      const result = await transcriber(audio, opts)
      self.postMessage({ type: "result", text: result.text })
    } catch (err) {
      const message = err?.message ? String(err.message) : String(err)
      self.postMessage({ type: "error", message })
    }
    return
  }
})
