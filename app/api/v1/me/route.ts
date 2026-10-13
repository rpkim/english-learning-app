import { requireV1Auth } from "@/lib/api-v1/guard"
import { errorV1, jsonV1, optionsV1 } from "@/lib/api-v1/http"

export function OPTIONS() {
  return optionsV1()
}

export async function GET(request: Request) {
  const auth = await requireV1Auth(request)
  if (auth instanceof Response) return auth
  try {
    return jsonV1({ user_id: auth.userId, via: auth.via })
  } catch (e) {
    return errorV1(e instanceof Error ? e.message : "Failed", 500)
  }
}
