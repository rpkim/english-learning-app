import { createBrowserClient } from "@supabase/ssr"

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""
  return {
    url,
    anonKey,
    configured: Boolean(url && anonKey),
  }
}

export function createClient() {
  const { url, anonKey, configured } = getPublicSupabaseEnv()
  if (!configured) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local."
    )
  }
  return createBrowserClient(url, anonKey)
}

// Singleton for client components
let _client: ReturnType<typeof createClient> | null = null
export function getSupabaseClient() {
  if (!_client) _client = createClient()
  return _client
}
