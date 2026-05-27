"use client"

import { useState } from "react"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Loader2 } from "lucide-react"

export function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signInWithGoogle = async () => {
    setLoading(true)
    setError(null)
    const sb = getSupabaseClient()
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success, browser redirects to Google — no need to setLoading(false)
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-8 bg-background px-6">
      {/* Logo + title */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth={1.8}>
            <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinejoin="round" />
            <path d="M2 17l10 5 10-5" strokeLinejoin="round" />
            <path d="M2 12l10 5 10-5" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SurviveEnglish</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI 영어 튜터 · 단어장 · 발음 학습
          </p>
        </div>
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <p className="mb-5 text-center text-sm text-muted-foreground">
          Google 계정으로 로그인하면 단어장과 학습 기록이<br />
          모든 기기에서 동기화됩니다.
        </p>

        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {loading ? "로그인 중…" : "Google로 계속하기"}
        </button>

        {error && (
          <p className="mt-3 text-center text-xs text-destructive">{error}</p>
        )}
      </div>

      <p className="max-w-[28ch] text-center text-[11px] text-muted-foreground/60 leading-relaxed">
        로그인 시 서비스 이용약관 및 개인정보처리방침에 동의하게 됩니다.
      </p>
    </div>
  )
}
