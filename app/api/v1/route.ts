import { jsonV1, optionsV1 } from "@/lib/api-v1/http"

export function OPTIONS() {
  return optionsV1()
}

export function GET() {
  return jsonV1({
    name: "SurviveEnglish API",
    version: "v1",
    auth: "Bearer se_live_… (API key) or signed-in session cookie",
    endpoints: {
      me: "GET /api/v1/me",
      keys: "GET|POST /api/v1/keys  DELETE /api/v1/keys/:id",
      vocabulary: "GET|POST /api/v1/vocabulary  GET|PATCH|DELETE /api/v1/vocabulary/:id",
      vocabularyImage: "GET /api/v1/vocabulary/:id/image?format=png",
      conversations: "GET|POST /api/v1/conversations  GET|PATCH|DELETE /api/v1/conversations/:id",
      tutorLookup: "POST /api/v1/tutor/lookup",
      mcp: "POST /api/mcp",
    },
  })
}
