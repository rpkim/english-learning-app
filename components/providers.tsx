"use client"

import { ThemeProvider } from "next-themes"
import { LocaleProvider } from "@/lib/locale-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <LocaleProvider>
        {children}
      </LocaleProvider>
    </ThemeProvider>
  )
}
