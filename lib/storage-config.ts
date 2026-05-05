export type StorageMode = "supabase" | "local"
export type TranslationProvider = "gemini" | "translate_api"

/** Open-source ASR models runnable in-browser via Transformers.js (ONNX). */
export const LOCAL_ASR_MODELS = [
  "whisper-base",
  "whisper-tiny",
  "wav2vec2-base-960h",
  "distil-whisper-small-en",
  "whisper-small",
  "wav2vec2-large-xlsr-53-en",
] as const

export type LocalAsrModel = (typeof LOCAL_ASR_MODELS)[number]

export function isLocalAsrModel(value: string): value is LocalAsrModel {
  return (LOCAL_ASR_MODELS as readonly string[]).includes(value)
}

export function localAsrModelShortLabel(model: LocalAsrModel): string {
  switch (model) {
    case "distil-whisper-small-en":
      return "Distil-Whisper Small"
    case "whisper-tiny":
      return "Whisper Tiny"
    case "whisper-base":
      return "Whisper Base"
    case "whisper-small":
      return "Whisper Small"
    case "wav2vec2-base-960h":
      return "Wav2Vec2 Base"
    case "wav2vec2-large-xlsr-53-en":
      return "Wav2Vec2 Large (EN)"
    default:
      return "speech model"
  }
}

export interface StorageConfig {
  mode: StorageMode
  supabaseUrl: string
  supabaseAnonKey: string
  localAsrModel: LocalAsrModel
  translationProviderRecent: TranslationProvider
  translationProviderAll: TranslationProvider
  topWordExcludes: string[]
}

const CONFIG_KEY = "englishlens_storage_config"

function hasBuiltInSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

function migrateToLocalAsrModel(raw: Record<string, unknown>): LocalAsrModel {
  const direct = raw.localAsrModel
  if (typeof direct === "string" && isLocalAsrModel(direct)) {
    return direct
  }
  const wm = raw.whisperModel
  if (wm === "tiny") return "whisper-tiny"
  if (wm === "base") return "whisper-base"
  if (wm === "small" || wm === "medium") return "whisper-small"
  return "whisper-base"
}

const DEFAULT_CONFIG: StorageConfig = {
  mode: "local",
  supabaseUrl: "",
  supabaseAnonKey: "",
  /** Whisper Base: stronger than Tiny, lighter than Small — default balance for browser CPU. */
  localAsrModel: "whisper-base",
  translationProviderRecent: "gemini",
  translationProviderAll: "translate_api",
  topWordExcludes: [],
}

export function getStorageConfig(): StorageConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsedRaw = { ...DEFAULT_CONFIG, ...JSON.parse(raw) } as StorageConfig & {
      translationProvider?: TranslationProvider
      whisperModel?: string
    }
    let parsed: StorageConfig = {
      mode: parsedRaw.mode,
      supabaseUrl: parsedRaw.supabaseUrl,
      supabaseAnonKey: parsedRaw.supabaseAnonKey,
      translationProviderRecent: parsedRaw.translationProviderRecent ?? parsedRaw.translationProvider ?? "gemini",
      translationProviderAll: parsedRaw.translationProviderAll ?? parsedRaw.translationProvider ?? "translate_api",
      localAsrModel: migrateToLocalAsrModel(parsedRaw as unknown as Record<string, unknown>),
      topWordExcludes: Array.isArray(parsedRaw.topWordExcludes) ? parsedRaw.topWordExcludes : [],
    }

    // If Supabase mode was saved but no built-in env exists and no custom credentials
    // are set, force local mode to avoid API 500s on first load.
    const hasCustomSupabaseCreds = Boolean(parsed.supabaseUrl && parsed.supabaseAnonKey)
    if (parsed.mode === "supabase" && !hasBuiltInSupabaseEnv() && !hasCustomSupabaseCreds) {
      parsed = { ...parsed, mode: "local" }
    }

    return parsed
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveStorageConfig(config: StorageConfig): void {
  if (typeof window === "undefined") return
  const payload: StorageConfig = {
    mode: config.mode,
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    localAsrModel: config.localAsrModel,
    translationProviderRecent: config.translationProviderRecent,
    translationProviderAll: config.translationProviderAll,
    topWordExcludes: config.topWordExcludes ?? [],
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(payload))
}
