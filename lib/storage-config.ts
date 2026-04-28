export type StorageMode = "supabase" | "local"
export type WhisperModel = "tiny" | "base" | "small" | "medium"

export interface StorageConfig {
  mode: StorageMode
  supabaseUrl: string
  supabaseAnonKey: string
  whisperModel: WhisperModel
  topWordExcludes: string[]
}

const CONFIG_KEY = "englishlens_storage_config"

function hasBuiltInSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

const DEFAULT_CONFIG: StorageConfig = {
  mode: hasBuiltInSupabaseEnv() ? "supabase" : "local",
  supabaseUrl: "",
  supabaseAnonKey: "",
  whisperModel: "tiny",
  topWordExcludes: [],
}

export function getStorageConfig(): StorageConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed = { ...DEFAULT_CONFIG, ...JSON.parse(raw) } as StorageConfig
    const normalizedWhisperModel = parsed.whisperModel === "medium" ? "small" : parsed.whisperModel

    // If Supabase mode was saved but no built-in env exists and no custom credentials
    // are set, force local mode to avoid API 500s on first load.
    const hasCustomSupabaseCreds = Boolean(parsed.supabaseUrl && parsed.supabaseAnonKey)
    if (parsed.mode === "supabase" && !hasBuiltInSupabaseEnv() && !hasCustomSupabaseCreds) {
      return { ...parsed, mode: "local", whisperModel: normalizedWhisperModel }
    }

    return { ...parsed, whisperModel: normalizedWhisperModel }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveStorageConfig(config: StorageConfig): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}
