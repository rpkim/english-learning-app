import { generateApiKey, getUserScopedClient, hashApiKey, keyPrefixOf, publicSupabaseConfigured } from "@/lib/api-v1/auth"
import { errorV1, jsonV1, optionsV1 } from "@/lib/api-v1/http"

export const dynamic = "force-dynamic"

export function OPTIONS() {
  return optionsV1()
}

export async function GET(request: Request) {
  if (!publicSupabaseConfigured()) return errorV1("Not configured", 503)
  const scoped = await getUserScopedClient(request)
  if (!scoped) return errorV1("Sign in to manage API keys", 401)
  const { data, error } = await scoped.supabase
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at")
    .eq("user_id", scoped.user.id)
    .order("created_at", { ascending: false })
  if (error) return errorV1(error.message, 500)
  return jsonV1({ items: data ?? [] })
}

export async function POST(request: Request) {
  if (!publicSupabaseConfigured()) return errorV1("Not configured", 503)
  const scoped = await getUserScopedClient(request)
  if (!scoped) return errorV1("Sign in to create an API key", 401)

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "default"
  const key = generateApiKey()
  const { data, error } = await scoped.supabase
    .from("api_keys")
    .insert({
      user_id: scoped.user.id,
      name,
      key_prefix: keyPrefixOf(key),
      key_hash: hashApiKey(key),
    })
    .select("id, name, key_prefix, created_at")
    .single()
  if (error) return errorV1(error.message, 500)
  return jsonV1({ ...data, key, warning: "Copy this key now. It will not be shown again." }, 201)
}
