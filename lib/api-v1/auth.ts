import { createHash, randomBytes } from "crypto"
import { createServerClient } from "@supabase/ssr"
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { getSupabaseAdmin, hasServiceRole } from "@/lib/supabase-admin"

export const API_KEY_PREFIX = "se_live_"

export type ApiAuth = {
  userId: string
  via: "session" | "api_key"
  keyId?: string
}

export type SessionScopedClient = {
  user: User
  supabase: SupabaseClient
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

function publicSupabaseEnv(): { url: string; anon: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  return { url, anon }
}

export function publicSupabaseConfigured(): boolean {
  return publicSupabaseEnv() !== null
}

function bearerFrom(request: Request | undefined): string | undefined {
  const header = request?.headers.get("authorization") ?? ""
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
}

export async function getSessionClient() {
  const env = publicSupabaseEnv()
  if (!env) return null
  const cookieStore = await cookies()
  return createServerClient(env.url, env.anon, {
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

function clientFromAccessToken(accessToken: string): SupabaseClient | null {
  const env = publicSupabaseEnv()
  if (!env) return null
  return createClient(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

/**
 * Signed-in user + anon-key client for key management (no service role).
 * Prefers a fresh Supabase access token from Authorization, then session cookies.
 * Ignores se_live_ API keys — those cannot create/list/revoke keys.
 */
export async function getUserScopedClient(request: Request): Promise<SessionScopedClient | null> {
  const bearer = bearerFrom(request)
  if (bearer && !bearer.startsWith(API_KEY_PREFIX)) {
    const jwtClient = clientFromAccessToken(bearer)
    if (jwtClient) {
      const { data: { user } } = await jwtClient.auth.getUser(bearer)
      if (user) return { user, supabase: jwtClient }
    }
  }

  const cookieClient = await getSessionClient()
  if (cookieClient) {
    const { data: { user } } = await cookieClient.auth.getUser()
    if (user) return { user, supabase: cookieClient }
  }

  return null
}

async function userFromSession(request?: Request): Promise<string | null> {
  if (request) {
    const scoped = await getUserScopedClient(request)
    return scoped?.user.id ?? null
  }
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

  const sessionUser = await userFromSession(request)
  if (sessionUser) return { userId: sessionUser, via: "session" }

  if (bearer) return { error: "Invalid bearer token", status: 401 }
  return { error: "Unauthorized — send Authorization: Bearer se_live_… or sign in", status: 401 }
}

export function isAuthError(value: ApiAuth | { error: string; status: number }): value is { error: string; status: number } {
  return "error" in value
}
