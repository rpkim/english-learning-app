import { generateApiKey, getSessionClient, hashApiKey, keyPrefixOf } from "@/lib/api-v1/auth"
import { errorV1, jsonV1, optionsV1 } from "@/lib/api-v1/http"

export function OPTIONS() {
  return optionsV1()
}

export async function GET() {
  const supabase = await getSessionClient()
  if (!supabase) return errorV1("Not configured", 503)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorV1("Sign in to manage API keys", 401)
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error) return errorV1(error.message, 500)
  return jsonV1({ items: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await getSessionClient()
  if (!supabase) return errorV1("Not configured", 503)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorV1("Sign in to create an API key", 401)

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "default"
  const key = generateApiKey()
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      name,
      key_prefix: keyPrefixOf(key),
      key_hash: hashApiKey(key),
    })
    .select("id, name, key_prefix, created_at")
    .single()
  if (error) return errorV1(error.message, 500)
  return jsonV1({ ...data, key, warning: "Copy this key now. It will not be shown again." }, 201)
}
