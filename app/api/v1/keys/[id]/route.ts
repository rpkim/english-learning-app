import { getUserScopedClient, publicSupabaseConfigured } from "@/lib/api-v1/auth"
import { errorV1, jsonV1, optionsV1 } from "@/lib/api-v1/http"

export const dynamic = "force-dynamic"

export function OPTIONS() {
  return optionsV1()
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!publicSupabaseConfigured()) return errorV1("Not configured", 503)
  const scoped = await getUserScopedClient(request)
  if (!scoped) return errorV1("Sign in to delete API keys", 401)
  const { error } = await scoped.supabase.from("api_keys").delete().eq("id", id).eq("user_id", scoped.user.id)
  if (error) return errorV1(error.message, 500)
  return jsonV1({ ok: true })
}
