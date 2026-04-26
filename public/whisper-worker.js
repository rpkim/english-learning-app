/**
 * Whisper transcription Web Worker using @xenova/transformers
 * Runs whisper-tiny.en entirely in the browser — no API key needed.
 */

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js"

// Allow local model caching in the browser
env.allowLocalModels = false
env.useBrowserCache = true

let transcriber = null

async function loadModel() {
  self.postMessage({ type: "loading", message: "Downloading Whisper model (first time only)..." })
  transcriber = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-tiny.en",
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
  self.postMessage({ type: "ready" })
}

self.addEventListener("message", async (event) => {
  const { type, audio } = event.data

  if (type === "load") {
    await loadModel()
    return
  }

  if (type === "transcribe") {
    if (!transcriber) {
      self.postMessage({ type: "error", message: "Model not loaded" })
      return
    }
    try {
      const result = await transcriber(audio, {
        sampling_rate: 16000,
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      })
      self.postMessage({ type: "result", text: result.text })
    } catch (err) {
      self.postMessage({ type: "error", message: err.message })
    }
    return
  }
})
