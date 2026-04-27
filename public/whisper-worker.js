/**
 * Whisper transcription Web Worker using @xenova/transformers
 * Runs whisper-tiny.en entirely in the browser — no API key needed.
 */

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js"

// Allow local model caching in the browser
env.allowLocalModels = false
env.useBrowserCache = true

let transcriber = null
let loadedModelId = null

async function loadModel(model = "tiny") {
  const modelMap = {
    tiny: "Xenova/whisper-tiny.en",
    base: "Xenova/whisper-base.en",
    small: "Xenova/whisper-small.en",
    medium: "Xenova/whisper-medium.en",
  }
  const modelId = modelMap[model] || modelMap.tiny
  if (transcriber && loadedModelId === modelId) {
    self.postMessage({ type: "ready" })
    return
  }

  if (transcriber && typeof transcriber.dispose === "function") {
    try {
      await transcriber.dispose()
    } catch {}
  }

  self.postMessage({ type: "loading", message: "Downloading Whisper model (first time only)..." })
  transcriber = await pipeline(
    "automatic-speech-recognition",
    modelId,
    {
      progress_callback: (p) => {
        if (p.status === "progress") {
          self.postMessage({
            type: "loading_progress",
            progress: Math.round(p.progress),
            file: p.file,
          })
        }
      },
    }
  )
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
      const effectiveModel = model || "tiny"
      const isLargeModel = effectiveModel === "small" || effectiveModel === "medium"
      const result = await transcriber(audio, {
        sampling_rate: typeof samplingRate === "number" ? samplingRate : 16000,
        // Keep shorter windows for lower perceived latency.
        chunk_length_s: isLargeModel ? 4 : 5,
        stride_length_s: 1,
        return_timestamps: false,
      })
      self.postMessage({ type: "result", text: result.text })
    } catch (err) {
      self.postMessage({ type: "error", message: err.message })
    }
    return
  }
})
