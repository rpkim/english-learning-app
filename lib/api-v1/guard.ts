import { authenticateV1, isAuthError, type ApiAuth } from "@/lib/api-v1/auth"
import { errorV1 } from "@/lib/api-v1/http"
import { hasServiceRole } from "@/lib/supabase-admin"

export async function requireV1Auth(request: Request): Promise<ApiAuth | Response> {
  const auth = await authenticateV1(request)
  if (isAuthError(auth)) return errorV1(auth.error, auth.status)
  if (!hasServiceRole()) {
    return errorV1("SUPABASE_SERVICE_ROLE_KEY is required for the REST/MCP API", 503)
  }
  return auth
}
