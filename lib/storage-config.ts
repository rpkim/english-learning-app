export type StorageMode = "supabase" | "local"

export interface StorageConfig {
  mode: StorageMode
  supabaseUrl: string
  supabaseAnonKey: string
}

const CONFIG_KEY = "englishlens_storage_config"

const DEFAULT_CONFIG: StorageConfig = {
  mode: "supabase",
  supabaseUrl: "",
  supabaseAnonKey: "",
}

export function getStorageConfig(): StorageConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return DEFAULT_CONFIG
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveStorageConfig(config: StorageConfig): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}
