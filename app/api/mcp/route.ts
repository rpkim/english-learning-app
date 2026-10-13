import { authenticateV1, isAuthError } from "@/lib/api-v1/auth"
import { corsHeaders, errorV1, jsonV1, optionsV1 } from "@/lib/api-v1/http"
import {
  addUserSentence,
  createVocabulary,
  deleteVocabulary,
  getConversation,
  getVocabulary,
  listConversations,
  listVocabulary,
  updateVocabulary,
} from "@/lib/api-v1/store"
import { hasServiceRole } from "@/lib/supabase-admin"
import { runTutorLookup, type LookupType } from "@/lib/tutor-lookup"
import type { VocabularyItem } from "@/lib/types"

export const maxDuration = 60

export function OPTIONS() {
  return optionsV1()
}

export function GET() {
  return jsonV1({
    name: "SurviveEnglish MCP",
    transport: "streamable-http",
    endpoint: "/api/mcp",
    auth: "Authorization: Bearer se_live_…",
  })
}

type RpcReq = {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

const TOOLS = [
  {
    name: "list_vocabulary",
    description: "List or search the user's SurviveEnglish vocabulary items.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search word, meaning, example, or context" },
        collection: { type: "string" },
        type: { type: "string", description: "word | expression | rephrase | translate | …" },
        mastered: { type: "boolean" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "get_vocabulary",
    description: "Get one vocabulary item by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "add_vocabulary",
    description: "Add a word or expression to the user's word list. Assigned to 📥 Inbox unless collection is set.",
    inputSchema: {
      type: "object",
      properties: {
        word: { type: "string" },
        type: { type: "string" },
        definition: { type: "string" },
        korean_translation: { type: "string" },
        example_sentence: { type: "string" },
        context: { type: "string" },
        collection: { type: "string", description: "Optional. Defaults to 📥 Inbox." },
      },
      required: ["word"],
    },
  },
  {
    name: "update_vocabulary",
    description: "Update fields on a vocabulary item (meaning, mastered, view_count, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        definition: { type: "string" },
        korean_translation: { type: "string" },
        example_sentence: { type: "string" },
        context: { type: "string" },
        is_mastered: { type: "boolean" },
        collection: { type: "string" },
        view_count: { type: "number" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_vocabulary",
    description: "Delete a vocabulary item by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "add_user_sentence",
    description: "Save a personal example sentence on a vocabulary item.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Vocabulary item id" },
        text: { type: "string" },
      },
      required: ["id", "text"],
    },
  },
  {
    name: "list_conversations",
    description: "List captured conversation sessions.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "get_conversation",
    description: "Get a captured conversation including its transcript.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "tutor_lookup",
    description: "Ask SurviveEnglish tutor: meaning, translate, or make-more-natural. Optional context disambiguates.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        type: { type: "string", enum: ["meaning", "translate", "naturalize"] },
        context: { type: "string" },
        targetLang: { type: "string", description: "ko | en | ja | es" },
      },
      required: ["text", "type"],
    },
  },
]

function rpcResult(id: RpcReq["id"], result: unknown) {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, result },
    { headers: corsHeaders() },
  )
}

function rpcError(id: RpcReq["id"], code: number, message: string, status = 200) {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status, headers: corsHeaders() },
  )
}

function asText(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}

async function callTool(userId: string, name: string, args: Record<string, unknown>) {
  const str = (key: string) => (typeof args[key] === "string" ? (args[key] as string).trim() : "")
  const num = (key: string, fallback: number) => {
    const n = Number(args[key])
    return Number.isFinite(n) ? n : fallback
  }

  switch (name) {
    case "list_vocabulary":
      return asText(await listVocabulary(userId, {
        q: str("q") || undefined,
        collection: str("collection") || undefined,
        type: str("type") || undefined,
        mastered: typeof args.mastered === "boolean" ? args.mastered : undefined,
        limit: Math.min(200, Math.max(1, num("limit", 30))),
        offset: Math.max(0, num("offset", 0)),
      }))
    case "get_vocabulary": {
      const item = await getVocabulary(userId, str("id"))
      if (!item) throw new Error("Not found")
      return asText(item)
    }
    case "add_vocabulary": {
      const word = str("word")
      if (!word) throw new Error("word is required")
      return asText(await createVocabulary(userId, {
        word,
        type: (str("type") || "word") as VocabularyItem["type"],
        definition: str("definition") || null,
        korean_translation: str("korean_translation") || null,
        example_sentence: str("example_sentence") || null,
        context: str("context") || null,
        is_mastered: false,
        conversation_id: null,
        ...(str("collection") ? { collection: str("collection") } : {}),
      }))
    }
    case "update_vocabulary": {
      const id = str("id")
      if (!id) throw new Error("id is required")
      const fields: Partial<VocabularyItem> = {}
      if ("definition" in args) fields.definition = str("definition") || null
      if ("korean_translation" in args) fields.korean_translation = str("korean_translation") || null
      if ("example_sentence" in args) fields.example_sentence = str("example_sentence") || null
      if ("context" in args) fields.context = str("context") || null
      if ("collection" in args) fields.collection = str("collection") || null
      if (typeof args.is_mastered === "boolean") fields.is_mastered = args.is_mastered
      if (typeof args.view_count === "number") fields.view_count = args.view_count
      return asText(await updateVocabulary(userId, id, fields))
    }
    case "delete_vocabulary": {
      const ok = await deleteVocabulary(userId, str("id"))
      if (!ok) throw new Error("Not found")
      return asText({ ok: true })
    }
    case "add_user_sentence":
      return asText(await addUserSentence(userId, str("id"), str("text")))
    case "list_conversations":
      return asText(await listConversations(userId, {
        limit: Math.min(200, Math.max(1, num("limit", 20))),
        offset: Math.max(0, num("offset", 0)),
      }))
    case "get_conversation": {
      const item = await getConversation(userId, str("id"))
      if (!item) throw new Error("Not found")
      return asText(item)
    }
    case "tutor_lookup": {
      const text = str("text")
      const type = str("type") as LookupType
      if (!text) throw new Error("text is required")
      if (!["meaning", "translate", "naturalize"].includes(type)) {
        throw new Error("type must be meaning, translate, or naturalize")
      }
      return asText(await runTutorLookup({
        text,
        type,
        context: str("context") || undefined,
        targetLang: str("targetLang") || "ko",
      }))
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

async function handleRpc(msg: RpcReq, userId: string): Promise<Response> {
  const method = msg.method ?? ""
  const id = msg.id
  const isNotification = id === undefined

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "surviveenglish", version: "0.1.0" },
    })
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return new Response(null, { status: isNotification ? 202 : 200, headers: corsHeaders() })
  }
  if (method === "ping") return rpcResult(id, {})
  if (method === "tools/list") return rpcResult(id, { tools: TOOLS })
  if (method === "tools/call") {
    const name = typeof msg.params?.name === "string" ? msg.params.name : ""
    const args = (msg.params?.arguments && typeof msg.params.arguments === "object"
      ? msg.params.arguments
      : {}) as Record<string, unknown>
    try {
      const result = await callTool(userId, name, args)
      return rpcResult(id, result)
    } catch (e) {
      return rpcResult(id, {
        content: [{ type: "text", text: e instanceof Error ? e.message : "Tool failed" }],
        isError: true,
      })
    }
  }
  if (isNotification) return new Response(null, { status: 202, headers: corsHeaders() })
  return rpcError(id, -32601, `Method not found: ${method}`)
}

export async function POST(request: Request) {
  const auth = await authenticateV1(request)
  if (isAuthError(auth)) {
    return errorV1(auth.error, auth.status)
  }
  if (!hasServiceRole()) {
    return errorV1("SUPABASE_SERVICE_ROLE_KEY is required for MCP", 503)
  }

  const body = await request.json().catch(() => null)
  if (Array.isArray(body)) {
    const parts = await Promise.all(body.map((msg: RpcReq) => handleRpc(msg, auth.userId)))
    const payloads = await Promise.all(parts.map(async (r) => {
      const text = await r.text()
      return text ? JSON.parse(text) : null
    }))
    return Response.json(payloads.filter(Boolean), { headers: corsHeaders() })
  }
  if (!body || typeof body !== "object") {
    return rpcError(null, -32700, "Parse error", 400)
  }
  return handleRpc(body as RpcReq, auth.userId)
}
