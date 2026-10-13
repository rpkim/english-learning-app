/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@resvg/resvg-js"],
  // Bundle the Noto Sans KR TTF into the image/MCP serverless functions.
  outputFileTracingIncludes: {
    "/api/v1/vocabulary/[id]/image": ["./assets/fonts/**/*"],
    "/api/mcp": ["./assets/fonts/**/*"],
  },
  // Allow SharedArrayBuffer for Whisper WASM (required for @xenova/transformers)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ]
  },
}

export default nextConfig
