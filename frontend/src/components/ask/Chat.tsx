import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, LoaderCircle, MessagesSquare, RotateCcw, SendHorizontal, Trash2 } from 'lucide-react'
import { AnswerView } from '@/components/ask/AnswerView'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ChatError, Pending } from '@/hooks/use-chat'
import { MAX_QUESTION_CHARS } from '@/lib/api'
import type { ChatTurn } from '@/types'

type ChatProps = {
  // The heading and description, passed in so the phone sheet can use the dialog's own (screen readers need them).
  title: ReactNode
  description: ReactNode
  close?: ReactNode
  turns: ChatTurn[]
  // Imported packs say their passages come from the file, which WardWise cannot vouch for.
  imported: boolean
  pending: Pending | null
  error: ChatError | null
  suggestions: string[]
  draft: string
  onDraftChange: (draft: string) => void
  onAsk: (question: string) => void
  onRemove: (id: string) => void
}

export function Chat(props: ChatProps) {
  const { title, description, close, turns, imported, pending, error, suggestions, draft, onDraftChange, onAsk, onRemove } = props
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()
  const busy = pending !== null
  const question = draft.trim()
  const canSend = !busy && question.length >= 2

  // Each new turn is scrolled to its start, so a long answer is read from the top. Only the list scrolls,
  // never the page behind it.
  const pendingQuestion = pending?.question
  useEffect(() => {
    const list = listRef.current
    const last = list?.querySelector<HTMLElement>('[data-turn]:last-child')
    if (!list || !last) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollTo({ top: last.offsetTop - 12, behavior: smooth ? 'smooth' : 'auto' })
  }, [turns.length, pendingQuestion, error])

  // The button pressed disappears with what it belonged to, so focus goes to the question box, not the page.
  function askFrom(text: string) {
    onAsk(text)
    inputRef.current?.focus()
  }

  function remove(id: string) {
    onRemove(id)
    inputRef.current?.focus()
  }

  function send(event?: FormEvent) {
    event?.preventDefault()
    if (!canSend) return
    onAsk(question)
    onDraftChange('')
  }

  const announcement = pending ? pending.step : error ? error.message : turns.length > 0 ? 'Answer ready.' : ''

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-3 border-b p-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <MessagesSquare className="size-[1.1rem]" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          {title}
          {description}
        </div>
        {close}
      </header>

      <div ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto p-4">
        {turns.length === 0 && !pending && !error ? (
          <Empty suggestions={suggestions} onAsk={askFrom} />
        ) : (
          <ol className="flex flex-col gap-7">
            {turns.map((turn) => (
              <li key={turn.id} data-turn className="flex flex-col gap-3">
                <Question text={turn.question} />
                <AnswerView answer={turn.answer} asked={turn.question} imported={imported} />
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => remove(turn.id)}
                  className="self-start text-muted-foreground"
                  aria-label={`Remove this question and answer: ${turn.question}`}
                >
                  <Trash2 aria-hidden="true" />
                  Remove
                </Button>
              </li>
            ))}
            {pending && (
              <li data-turn className="flex flex-col gap-3">
                <Question text={pending.question} />
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 shrink-0 text-primary motion-safe:animate-spin" aria-hidden="true" />
                  {pending.step}
                </p>
              </li>
            )}
            {error && (
              <li data-turn className="flex flex-col gap-3">
                <Question text={error.question} />
                <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                    {error.message}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => askFrom(error.question)}>
                    <RotateCcw aria-hidden="true" />
                    Try again
                  </Button>
                </div>
              </li>
            )}
          </ol>
        )}
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      <form onSubmit={send} className="border-t p-3">
        <div className="flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">
            Your question
          </label>
          <Textarea
            ref={inputRef}
            id={inputId}
            rows={1}
            value={draft}
            maxLength={MAX_QUESTION_CHARS}
            placeholder="Ask about this session"
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter starts a new line. Not while an input method is composing a word.
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) send(event)
            }}
            className="max-h-32 min-h-10 resize-none"
          />
          <Button type="submit" size="icon" disabled={!canSend} aria-label="Send question" className="shrink-0">
            {busy ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <SendHorizontal aria-hidden="true" />}
          </Button>
        </div>
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          Ask about the teaching only. Never type a patient's name or details.
        </p>
      </form>
    </div>
  )
}

function Question({ text }: { text: string }) {
  return (
    <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-line text-primary-foreground">
      <span className="sr-only">You asked: </span>
      {text}
    </p>
  )
}

function Empty({ suggestions, onAsk }: { suggestions: string[]; onAsk: (question: string) => void }) {
  return (
    <div className="flex flex-col gap-4 text-sm text-muted-foreground">
      <p>
        Ask anything about this session. WardWise searches your session, PubMed and StatPearls together, and shows
        where each part of the answer comes from.
      </p>
      {suggestions.length > 0 && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs font-medium">For example</p>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onAsk(suggestion)}
              className="cursor-pointer rounded-lg border bg-background/60 px-3 py-2 text-left text-xs text-foreground transition-colors outline-none hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
