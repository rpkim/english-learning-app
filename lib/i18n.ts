// ── Supported locales ─────────────────────────────────────────────────────
export type Locale = "ko" | "en" | "ja" | "es"

export const LOCALE_META: Record<Locale, { label: string; flag: string; aiName: string }> = {
  ko: { label: "한국어", flag: "🇰🇷", aiName: "Korean" },
  en: { label: "English", flag: "🇺🇸", aiName: "English" },
  ja: { label: "日本語", flag: "🇯🇵", aiName: "Japanese" },
  es: { label: "Español", flag: "🇪🇸", aiName: "Spanish" },
}

export const LOCALE_ORDER: Locale[] = ["ko", "en", "ja", "es"]

// ── String shape ───────────────────────────────────────────────────────────
interface I18nStrings {
  nav: { tutor: string; capture: string; words: string; study: string }
  capture: { record: string; sessions: string }
  tutor: {
    meaningLabel: string; meaningPlaceholder: string
    translateLabel: string; translatePlaceholder: string
    naturalizeLabel: string; naturalizePlaceholder: string
    save: string; pass: string; clearAll: string
    emptyMeaning: string; emptyTranslate: string; emptyNaturalize: string
    sending: string; sessionHint: string
  }
  words: {
    all: string; words: string; expression: string; rephrase: string
    sourceAll: string; sourceSession: string; sourceTutor: string
    empty: string; emptyTutor: string; masteredOnly: string
    hideMastered: (n: number) => string
    organize: string; organizing: string; add: string
    collection: string; collectionAll: string
    deck: string; list: string
    pdfDownload: string
  }
  study: {
    upgradeTitle: string; upgradeDesc: string
    storyTitle: string; storyDesc: string
    inputPlaceholder: string; inputHint: string
    upgradeButton: string; upgrading: string
    original: string; upgraded: string; explanation: string
    vocabUsed: string; otherVersions: string; changeDetail: string
    retry: string
    selectWords: string; selectAll: string; clearSelection: string
    length: string; short: string; medium: string; long: string
    generateStory: string; generating: string; regenerate: string; reselect: string
    wordsUsed: string
  }
  common: {
    loading: string; save: string; delete: string; cancel: string
    mastered: string; learning: string; close: string
  }
}

// ── Translations ───────────────────────────────────────────────────────────
const KO: I18nStrings = {
  nav: { tutor: "Tutor", capture: "Capture", words: "Words", study: "Study" },
  capture: { record: "Record", sessions: "Sessions" },
  tutor: {
    meaningLabel: "뜻이 뭐야?", meaningPlaceholder: "단어나 표현을 입력하세요",
    translateLabel: "번역해줘", translatePlaceholder: "번역할 문장을 입력하세요",
    naturalizeLabel: "더 자연스럽게", naturalizePlaceholder: "자연스럽게 다듬을 표현을 입력하세요",
    save: "단어장에 저장", pass: "패스", clearAll: "전체 지우기",
    emptyMeaning: "단어나 표현을 입력하면 뜻, 뉘앙스, 예문을 알려드려요",
    emptyTranslate: "한국어 문장을 입력하면 자연스러운 영어로 번역해드려요",
    emptyNaturalize: "영어 표현을 입력하면 더 자연스럽게 다듬어드려요",
    sending: "⌘+Enter 전송", sessionHint: "저장한 단어",
  },
  words: {
    all: "전체", words: "단어", expression: "표현", rephrase: "패러프레이즈",
    sourceAll: "All", sourceSession: "Session", sourceTutor: "Tutor",
    empty: "아직 저장된 단어가 없습니다.", emptyTutor: "Tutor에서 저장한 단어가 없습니다.",
    masteredOnly: "학습 완료된 단어만 있습니다.",
    hideMastered: (n) => `완료 ${n}`,
    organize: "AI 정리", organizing: "정리 중…", add: "추가",
    collection: "단어장", collectionAll: "전체",
    deck: "카드 보기", list: "리스트 보기",
    pdfDownload: "PDF 다운로드",
  },
  study: {
    upgradeTitle: "표현 업그레이드", upgradeDesc: "내 문장을 더 자연스럽게",
    storyTitle: "이야기 만들기", storyDesc: "단어로 스토리 학습",
    inputPlaceholder: "영어 문장을 입력하세요", inputHint: "⌘+Enter 전송 · 저장한 단어",
    upgradeButton: "업그레이드", upgrading: "업그레이드 중…",
    original: "원문", upgraded: "업그레이드", explanation: "설명",
    vocabUsed: "내 단어장에서 활용", otherVersions: "다른 버전",
    changeDetail: "변경 상세", retry: "다시 시도",
    selectWords: "단어 선택", selectAll: "전체 선택", clearSelection: "초기화",
    length: "길이", short: "짧게", medium: "보통", long: "길게",
    generateStory: "이야기 만들기", generating: "이야기 만드는 중…",
    regenerate: "다시 만들기", reselect: "← 단어 다시 선택",
    wordsUsed: "사용된 단어",
  },
  common: {
    loading: "로딩 중…", save: "저장", delete: "삭제", cancel: "취소",
    mastered: "학습 완료", learning: "학습 중", close: "닫기",
  },
}

const EN: I18nStrings = {
  nav: { tutor: "Tutor", capture: "Capture", words: "Words", study: "Study" },
  capture: { record: "Record", sessions: "Sessions" },
  tutor: {
    meaningLabel: "What does it mean?", meaningPlaceholder: "Enter a word or expression",
    translateLabel: "Translate", translatePlaceholder: "Enter a sentence to translate",
    naturalizeLabel: "Make it natural", naturalizePlaceholder: "Enter an expression to rephrase",
    save: "Save to vocabulary", pass: "Pass", clearAll: "Clear all",
    emptyMeaning: "Enter a word or phrase to see its meaning, nuance, and examples",
    emptyTranslate: "Enter a sentence to get a natural English translation",
    emptyNaturalize: "Enter an expression to get a more natural rephrasing",
    sending: "⌘+Enter to send", sessionHint: "saved words",
  },
  words: {
    all: "All", words: "Words", expression: "Expression", rephrase: "Rephrase",
    sourceAll: "All", sourceSession: "Session", sourceTutor: "Tutor",
    empty: "No vocabulary saved yet.", emptyTutor: "No words saved from Tutor.",
    masteredOnly: "Only mastered words remain.",
    hideMastered: (n) => `Mastered ${n}`,
    organize: "AI Organize", organizing: "Organizing…", add: "Add",
    collection: "Collections", collectionAll: "All",
    deck: "Card view", list: "List view",
    pdfDownload: "PDF Download",
  },
  study: {
    upgradeTitle: "Upgrade Expression", upgradeDesc: "Make your sentences more natural",
    storyTitle: "Create Story", storyDesc: "Learn with a vocabulary story",
    inputPlaceholder: "Enter an English sentence", inputHint: "⌘+Enter to send · saved words",
    upgradeButton: "Upgrade", upgrading: "Upgrading…",
    original: "Original", upgraded: "Upgraded", explanation: "Explanation",
    vocabUsed: "Your vocab used", otherVersions: "Other versions",
    changeDetail: "Change details", retry: "Try again",
    selectWords: "Select words", selectAll: "Select all", clearSelection: "Clear",
    length: "Length", short: "Short", medium: "Medium", long: "Long",
    generateStory: "Generate story", generating: "Generating story…",
    regenerate: "Regenerate", reselect: "← Reselect words",
    wordsUsed: "Words used",
  },
  common: {
    loading: "Loading…", save: "Save", delete: "Delete", cancel: "Cancel",
    mastered: "Mastered", learning: "Learning", close: "Close",
  },
}

const JA: I18nStrings = {
  nav: { tutor: "Tutor", capture: "Capture", words: "単語帳", study: "Study" },
  capture: { record: "録音", sessions: "Sessions" },
  tutor: {
    meaningLabel: "意味は？", meaningPlaceholder: "単語や表現を入力してください",
    translateLabel: "翻訳して", translatePlaceholder: "翻訳したい文を入力してください",
    naturalizeLabel: "より自然に", naturalizePlaceholder: "自然にしたい表現を入力してください",
    save: "単語帳に保存", pass: "パス", clearAll: "全て消す",
    emptyMeaning: "単語や表現を入力すると意味・ニュアンス・例文を教えます",
    emptyTranslate: "文を入力すると自然な英語に翻訳します",
    emptyNaturalize: "英語表現を入力するとより自然に言い換えます",
    sending: "⌘+Enter 送信", sessionHint: "保存した単語",
  },
  words: {
    all: "全て", words: "単語", expression: "表現", rephrase: "言い換え",
    sourceAll: "All", sourceSession: "Session", sourceTutor: "Tutor",
    empty: "まだ単語が保存されていません。", emptyTutor: "Tutorから保存した単語がありません。",
    masteredOnly: "マスター済みの単語のみです。",
    hideMastered: (n) => `習得済み ${n}`,
    organize: "AI整理", organizing: "整理中…", add: "追加",
    collection: "コレクション", collectionAll: "全て",
    deck: "カード表示", list: "リスト表示",
    pdfDownload: "PDFダウンロード",
  },
  study: {
    upgradeTitle: "表現アップグレード", upgradeDesc: "文をより自然に",
    storyTitle: "ストーリー作成", storyDesc: "単語でストーリー学習",
    inputPlaceholder: "英語の文を入力してください", inputHint: "⌘+Enter 送信 · 保存した単語",
    upgradeButton: "アップグレード", upgrading: "アップグレード中…",
    original: "原文", upgraded: "アップグレード", explanation: "説明",
    vocabUsed: "単語帳から活用", otherVersions: "他のバージョン",
    changeDetail: "変更詳細", retry: "やり直す",
    selectWords: "単語を選択", selectAll: "全て選択", clearSelection: "リセット",
    length: "長さ", short: "短く", medium: "普通", long: "長く",
    generateStory: "ストーリーを作る", generating: "ストーリー作成中…",
    regenerate: "再生成", reselect: "← 単語を再選択",
    wordsUsed: "使用された単語",
  },
  common: {
    loading: "読み込み中…", save: "保存", delete: "削除", cancel: "キャンセル",
    mastered: "習得済み", learning: "学習中", close: "閉じる",
  },
}

const ES: I18nStrings = {
  nav: { tutor: "Tutor", capture: "Captura", words: "Vocabulario", study: "Estudio" },
  capture: { record: "Grabar", sessions: "Sesiones" },
  tutor: {
    meaningLabel: "¿Qué significa?", meaningPlaceholder: "Escribe una palabra o expresión",
    translateLabel: "Traducir", translatePlaceholder: "Escribe la oración a traducir",
    naturalizeLabel: "Más natural", naturalizePlaceholder: "Escribe la expresión a reformular",
    save: "Guardar en vocabulario", pass: "Pasar", clearAll: "Borrar todo",
    emptyMeaning: "Escribe una palabra para ver su significado, matiz y ejemplos",
    emptyTranslate: "Escribe una oración para obtener una traducción natural al inglés",
    emptyNaturalize: "Escribe una expresión para reformularla más naturalmente",
    sending: "⌘+Enter para enviar", sessionHint: "palabras guardadas",
  },
  words: {
    all: "Todo", words: "Palabras", expression: "Expresión", rephrase: "Reformular",
    sourceAll: "Todo", sourceSession: "Sesión", sourceTutor: "Tutor",
    empty: "Todavía no hay vocabulario.", emptyTutor: "No hay palabras del Tutor.",
    masteredOnly: "Solo quedan palabras dominadas.",
    hideMastered: (n) => `Dominadas ${n}`,
    organize: "Organizar IA", organizing: "Organizando…", add: "Añadir",
    collection: "Colecciones", collectionAll: "Todo",
    deck: "Vista tarjeta", list: "Vista lista",
    pdfDownload: "Descargar PDF",
  },
  study: {
    upgradeTitle: "Mejorar expresión", upgradeDesc: "Haz tus frases más naturales",
    storyTitle: "Crear historia", storyDesc: "Aprende con una historia",
    inputPlaceholder: "Escribe una oración en inglés", inputHint: "⌘+Enter para enviar · palabras guardadas",
    upgradeButton: "Mejorar", upgrading: "Mejorando…",
    original: "Original", upgraded: "Mejorada", explanation: "Explicación",
    vocabUsed: "Tu vocabulario usado", otherVersions: "Otras versiones",
    changeDetail: "Detalles de cambios", retry: "Intentar de nuevo",
    selectWords: "Seleccionar palabras", selectAll: "Seleccionar todo", clearSelection: "Limpiar",
    length: "Longitud", short: "Corta", medium: "Media", long: "Larga",
    generateStory: "Generar historia", generating: "Generando historia…",
    regenerate: "Regenerar", reselect: "← Reseleccionar palabras",
    wordsUsed: "Palabras usadas",
  },
  common: {
    loading: "Cargando…", save: "Guardar", delete: "Eliminar", cancel: "Cancelar",
    mastered: "Dominado", learning: "Aprendiendo", close: "Cerrar",
  },
}

export const STRINGS: Record<Locale, I18nStrings> = { ko: KO, en: EN, ja: JA, es: ES }

export function t(locale: Locale): I18nStrings {
  return STRINGS[locale] ?? STRINGS.ko
}
