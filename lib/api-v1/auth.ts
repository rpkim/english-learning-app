import { createHash, randomBytes } from "crypto"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getSupabaseAdmin, hasServiceRole } from "@/lib/supabase-admin"

export const API_KEY_PREFIX = "se_live_"

export type ApiAuth = {
  userId: string
  via: "session" | "api_key"
  keyId?: string
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`
}

export function keyPrefixOf(fullKey: string): string {
  return fullKey.slice(0, API_KEY_PREFIX.length + 8)
}

export async function getSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  const cookieStore = await cookies()
  return createServerClient(url, anon, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          /* cookies may be read-only in some route contexts */
        }
      },
    },
  })
}

async function userFromSession(): Promise<string | null> {
  const supabase = await getSessionClient()
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function authenticateV1(request: Request): Promise<ApiAuth | { error: string; status: number }> {
  const header = request.headers.get("authorization") ?? ""
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()

  if (bearer?.startsWith(API_KEY_PREFIX)) {
    if (!hasServiceRole()) {
      return { error: "API keys require SUPABASE_SERVICE_ROLE_KEY on the server", status: 503 }
    }
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from("api_keys")
      .select("id, user_id")
      .eq("key_hash", hashApiKey(bearer))
      .maybeSingle()
    if (error) return { error: error.message, status: 500 }
    if (!data) return { error: "Invalid API key", status: 401 }
    void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id)
    return { userId: data.user_id as string, via: "api_key", keyId: data.id as string }
  }

  const sessionUser = await userFromSession()
  if (sessionUser) return { userId: sessionUser, via: "session" }

  if (bearer) return { error: "Invalid bearer token", status: 401 }
  return { error: "Unauthorized — send Authorization: Bearer se_live_… or sign in", status: 401 }
}

export function isAuthError(value: ApiAuth | { error: string; status: number }): value is { error: string; status: number } {
  return "error" in value
}
