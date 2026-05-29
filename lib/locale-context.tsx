"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { Locale } from "./i18n"
import { t } from "./i18n"

interface LocaleContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  strings: ReturnType<typeof t>
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "ko",
  setLocale: () => {},
  strings: t("ko"),
})

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko")

  useEffect(() => {
    try {
      const saved = localStorage.getItem("app-locale") as Locale | null
      if (saved && ["ko", "en", "ja", "es"].includes(saved)) setLocaleState(saved)
    } catch {}
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try { localStorage.setItem("app-locale", l) } catch {}
  }, [])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, strings: t(locale) }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
