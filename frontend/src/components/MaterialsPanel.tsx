import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, ChevronDown, Mic, NotebookPen, PenLine, ScanText, Undo2, X, type LucideIcon } from 'lucide-react'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { countWords, plural } from '@/lib/format'
import { countMarks, findMarks, type Mark, type MarkKind } from '@/lib/highlight'
import { hasCorrections, hasReviewable } from '@/lib/materials'
import { cn } from '@/lib/utils'
import type { Materials } from '@/types'

type MaterialsPanelProps = {
  // What WardWise heard and read, unchanged, and the student's corrected copy of it.
  heard: Materials
  draft: Materials
  // While WardWise writes, the text is read-only: the pack is written from the text as it was when sent.
  locked: boolean
  // True when the student must act here before a pack can be written (too long, nothing read, a failed
  // write). The panel then opens and comes into view; otherwise it starts folded below the pack.
  attention: boolean
  onChange: (draft: Materials) => void
  onClose: () => void
}

const MARK_STYLE: Record<MarkKind, string> = {
  number: 'bg-warning/20 text-foreground',
  drug: 'bg-accent text-accent-foreground',
  check: 'bg-destructive/15 text-foreground underline decoration-destructive decoration-wavy underline-offset-2',
}

const LEGEND: { kind: MarkKind; label: string }[] = [
  { kind: 'number', label: 'Numbers and doses' },
  { kind: 'drug', label: 'Drug names' },
  { kind: 'check', label: 'Close to a drug name: check it' },
]

export function MaterialsPanel({ heard, draft, locked, attention, onChange, onClose }: MaterialsPanelProps) {
  // Until the student opens or folds it, the panel is open exactly when it needs attention.
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? attention
  const [confirmingClose, setConfirmingClose] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const bodyId = useId()
  const confirmTextId = useId()
  const still = useReducedMotion()
  const { transcript, notes, warnings } = draft

  // A smooth scroll started while the page is still settling gets cancelled, so it waits a moment.
  useEffect(() => {
    if (!attention) return
    const id = window.setTimeout(
      () => rootRef.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }),
      150,
    )
    return () => window.clearTimeout(id)
  }, [attention, still])

  // Two memos, so a keystroke in one text does not redo the other.
  const transcriptMarks = useMemo(() => (transcript ? findMarks(transcript) : []), [transcript])
  const notesMarks = useMemo(() => (notes ? findMarks(notes) : []), [notes])
  const marks = { transcript: transcriptMarks, notes: notesMarks }
  const counts = countMarks([...marks.transcript, ...marks.notes])
  // A misheard word said many times is one thing to check.
  const misheard = new Set(
    [
      ...marks.transcript.map((mark) => mark.kind === 'check' && transcript?.slice(mark.start, mark.end).toLowerCase()),
      ...marks.notes.map((mark) => mark.kind === 'check' && notes?.slice(mark.start, mark.end).toLowerCase()),
    ].filter(Boolean),
  ).size

  function requestClose() {
    if (hasCorrections(heard, draft)) {
      setUserOpen(true)
      setConfirmingClose(true)
    } else onClose()
  }

  function keepEditing() {
    setConfirmingClose(false)
    closeRef.current?.focus()
  }

  const highlighted = [
    counts.numbers > 0 && plural(counts.numbers, 'number'),
    counts.drugs > 0 && plural(counts.drugs, 'drug name'),
  ].filter(Boolean)
  const summary = [
    highlighted.length > 0 && `${highlighted.join(' and ')} highlighted`,
    misheard > 0 && plural(misheard, 'word') + ' to check',
  ].filter(Boolean)
  // Before any pack is written from this reading, the advice is to correct first.
  const advice = attention
    ? 'Mistakes here end up in your pack: correct them before you write.'
    : 'Mistakes here end up in your pack: correct them, then write again.'

  return (
    <motion.div ref={rootRef} initial="hidden" animate="show" className="scroll-mt-6">
      <Panel
        icon={ScanText}
        title="Check what WardWise heard and read"
        description={
          hasReviewable(heard)
            ? `${summary.length ? `${summary.join(', ')}. ` : ''}${advice}`
            : 'WardWise could not read your recording or photos. Try again, with clearer photos or another recording.'
        }
        aside={
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setUserOpen(!open)}
            >
              {open ? 'Hide' : 'Show'}
              <ChevronDown className={cn('transition-transform', open && 'rotate-180')} aria-hidden="true" />
            </Button>
            {/* Closing forgets this reading, so it is not offered while a pack is being written from it. */}
            {!locked && (
              <Button ref={closeRef} variant="ghost" size="icon" onClick={requestClose} aria-label="Close what WardWise heard and read">
                <X />
              </Button>
            )}
          </div>
        }
      >
        {/* Warnings stay visible when folded: a pack written without a page or the recording must say so. */}
        {warnings.length > 0 && (
          <ul className="mb-4 flex flex-col gap-1.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            {warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                {warning}
              </li>
            ))}
          </ul>
        )}

        <div id={bodyId} hidden={!open} className="flex flex-col gap-4">
            {confirmingClose && (
              <div
                role="alertdialog"
                aria-labelledby={confirmTextId}
                onKeyDown={(event) => event.key === 'Escape' && keepEditing()}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm"
              >
                <span id={confirmTextId} className="flex-1">
                  Closing loses your corrections.
                </span>
                <Button size="sm" variant="outline" onClick={keepEditing} autoFocus>
                  Keep editing
                </Button>
                <Button size="sm" variant="destructive" onClick={onClose}>
                  Close anyway
                </Button>
              </div>
            )}

            {hasReviewable(heard) && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="What the highlights mean">
                {LEGEND.map(({ kind, label }) => (
                  <li key={kind} className="flex items-center gap-1.5">
                    <span className={cn('inline-block size-3 rounded-sm', MARK_STYLE[kind])} aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            )}

            {transcript !== null && (
              <TextSection
                icon={Mic}
                title="Recording transcript"
                detail={`${plural(countWords(transcript), 'word')} · AI-generated${transcript !== heard.transcript ? ', corrected by you' : ''}`}
                text={transcript}
                original={heard.transcript ?? ''}
                marks={marks.transcript}
                placeholder="No speech was heard."
                question="did they say"
                locked={locked}
                onChange={(text) => onChange({ ...draft, transcript: text })}
              />
            )}

            {notes !== null && (
              <TextSection
                icon={NotebookPen}
                title="Handwritten notes"
                detail={`${plural(countWords(notes), 'word')} · read by AI${notes !== heard.notes ? ', corrected by you' : ''}`}
                text={notes}
                original={heard.notes ?? ''}
                marks={marks.notes}
                placeholder="No handwriting was found."
                question="is this"
                locked={locked}
                onChange={(text) => onChange({ ...draft, notes: text })}
              />
            )}
          </div>
      </Panel>
    </motion.div>
  )
}

type TextSectionProps = {
  icon: LucideIcon
  title: string
  detail: string
  text: string
  original: string
  marks: Mark[]
  placeholder: string
  // How to ask about a word close to a drug name: "did they say" for speech, "is this" for handwriting.
  question: string
  locked: boolean
  onChange: (text: string) => void
}

// Read with highlights, or correct in a plain text box: a text box cannot show highlights.
function TextSection({ icon: Icon, title, detail, text, original, marks, placeholder, question, locked, onChange }: TextSectionProps) {
  const [editing, setEditing] = useState(false)
  // Writing locks the text; afterwards it opens in the read view, so the box does not grab focus on its return.
  if (locked && editing) setEditing(false)
  // One line per misheard word, however often it was said.
  const checks = new Map<string, { suggestion: string; times: number }>()
  for (const mark of marks) {
    if (mark.kind !== 'check' || !mark.suggestion) continue
    const word = text.slice(mark.start, mark.end).toLowerCase()
    checks.set(word, { suggestion: mark.suggestion, times: (checks.get(word)?.times ?? 0) + 1 })
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {title}
          <span className="font-normal text-muted-foreground">· {detail}</span>
        </h3>
        {!locked && (
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            <PenLine aria-hidden="true" />
            {editing ? 'Done correcting' : 'Correct'}
          </Button>
        )}
      </div>

      {editing && !locked ? (
        <EditableText value={text} original={original} label={title} placeholder={placeholder} onChange={onChange} />
      ) : (
        <HighlightedText text={text} marks={marks} label={title} placeholder={placeholder} />
      )}

      {checks.size > 0 && (
        <ul className="flex flex-col gap-1 text-xs">
          {[...checks].map(([word, { suggestion, times }]) => (
            <li key={word} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px size-3.5 shrink-0 text-destructive" aria-hidden="true" />
              <span>
                “{word}”{times > 1 && ` (${times} times)`}: {question} <strong>{suggestion}</strong>?
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function HighlightedText({ text, marks, label, placeholder }: { text: string; marks: Mark[]; label: string; placeholder: string }) {
  const parts: ReactNode[] = []
  let at = 0
  for (const mark of marks) {
    parts.push(text.slice(at, mark.start))
    parts.push(
      <mark key={mark.start} className={cn('rounded-sm px-0.5', MARK_STYLE[mark.kind])}>
        {text.slice(mark.start, mark.end)}
      </mark>,
    )
    at = mark.end
  }
  parts.push(text.slice(at))

  return (
    // Focusable so the keyboard can scroll a long transcript.
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      className="max-h-80 overflow-y-auto rounded-md border bg-background/60 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {text.trim() ? parts : <span className="text-muted-foreground">{placeholder}</span>}
    </div>
  )
}

type EditableTextProps = {
  value: string
  original: string
  label: string
  placeholder?: string
  onChange: (text: string) => void
}

// Controlled: the box shows `value` and sends every change up.
function EditableText({ value, original, label, placeholder, onChange }: EditableTextProps) {
  const boxRef = useRef<HTMLTextAreaElement>(null)

  // The undo button disappears once used, so focus goes back to the text.
  function undo() {
    onChange(original)
    boxRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Textarea
        ref={boxRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={placeholder}
        autoFocus
        className="max-h-80 min-h-32 resize-y overflow-y-auto bg-background/60 leading-relaxed"
      />
      {value !== original && (
        <button
          type="button"
          onClick={undo}
          aria-label={`Undo my corrections to ${label}`}
          className="inline-flex items-center gap-1.5 self-end text-xs font-medium text-primary hover:underline"
        >
          <Undo2 className="size-3.5" aria-hidden="true" />
          Undo my corrections
        </button>
      )}
    </div>
  )
}
