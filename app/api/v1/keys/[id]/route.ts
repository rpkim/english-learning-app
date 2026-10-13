import { getSessionClient } from "@/lib/api-v1/auth"
import { errorV1, jsonV1, optionsV1 } from "@/lib/api-v1/http"

export function OPTIONS() {
  return optionsV1()
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await getSessionClient()
  if (!supabase) return errorV1("Not configured", 503)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorV1("Sign in to delete API keys", 401)
  const { error } = await supabase.from("api_keys").delete().eq("id", id).eq("user_id", user.id)
  if (error) return errorV1(error.message, 500)
  return jsonV1({ ok: true })
}
