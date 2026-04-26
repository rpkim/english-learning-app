"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { X, Plus, Languages } from "lucide-react"

interface ManualAddFormProps {
  initialWord?: string
  onAdd: (item: {
    word: string
    type: string
    definition: string
    context: string
  }) => Promise<void>
  onTranslateSelected: (text: string) => Promise<void>
  translatedSelectedText: string | null
  isTranslatingSelected: boolean
  onCancel: () => void
  isSubmitting: boolean
}

export function ManualAddForm({
  initialWord = "",
  onAdd,
  onTranslateSelected,
  translatedSelectedText,
  isTranslatingSelected,
  onCancel,
  isSubmitting,
}: ManualAddFormProps) {
  const [word, setWord] = useState(initialWord)
  const [type, setType] = useState("word")
  const [definition, setDefinition] = useState("")
  const [context, setContext] = useState("")

  useEffect(() => {
    setWord(initialWord)
  }, [initialWord])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!word.trim()) return
    await onAdd({ word: word.trim(), type, definition, context })
    setWord("")
    setDefinition("")
    setContext("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border border-border rounded-xl p-4 bg-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Add vocabulary</p>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="word" className="text-xs">Word / Phrase</Label>
          <Input
            id="word"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="e.g. kick the bucket"
            className="h-8 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="type" className="text-xs">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="type" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="word">Word</SelectItem>
              <SelectItem value="idiom">Idiom</SelectItem>
              <SelectItem value="phrasal_verb">Phrasal Verb</SelectItem>
              <SelectItem value="expression">Expression</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="definition" className="text-xs">Definition (optional)</Label>
        <Input
          id="definition"
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          placeholder="Brief English definition"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="context" className="text-xs">Context (optional)</Label>
        <Textarea
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Sentence where you found this word"
          className="text-sm min-h-16 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full gap-1.5"
          disabled={isTranslatingSelected || !word.trim()}
          onClick={() => void onTranslateSelected(word.trim())}
        >
          <Languages className="h-3.5 w-3.5" />
          {isTranslatingSelected ? "Translating..." : "번역하기"}
        </Button>
        <Button type="submit" size="sm" className="w-full gap-1.5" disabled={isSubmitting || !word.trim()}>
          <Plus className="h-3.5 w-3.5" />
          {isSubmitting ? "Adding..." : "Add to Vocabulary"}
        </Button>
      </div>

      {translatedSelectedText && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="text-[11px] text-muted-foreground mb-1">Korean translation</p>
          <p className="text-sm text-foreground">{translatedSelectedText}</p>
        </div>
      )}
    </form>
  )
}
