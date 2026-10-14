import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let admin: SupabaseClient | null = null

function serviceRoleKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  )
}

export function hasServiceRole(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && serviceRoleKey())
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = serviceRoleKey()
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  }
  if (!admin) {
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return admin
}
