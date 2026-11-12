import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Popover } from 'radix-ui'
import { AlertTriangle, ChevronDown, Mic, NotebookPen, PenLine, ScanText, ShieldCheck, Undo2, X, type LucideIcon } from 'lucide-react'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { countWords, plural } from '@/lib/format'
import { findMarks, replaceWord, type Mark } from '@/lib/highlight'
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

const INK = { number: 'ink ink-dose', drug: 'ink ink-drug', check: 'ink ink-check' } as const

export function MaterialsPanel({ heard, draft, locked, attention, onChange, onClose }: MaterialsPanelProps) {
  // Until the student opens or folds it, the panel is open exactly when it needs attention.
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? attention
  const [confirmingClose, setConfirmingClose] = useState(false)
  // Words the student said were heard right, so they are no longer flagged.
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set())
  const rootRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const bodyId = useId()
  const confirmTextId = useId()
  const still = useReducedMotion()
  const { transcript, notes, warnings } = draft
  const checkFailed = warnings.some((warning) => warning.includes('could not check this session for names'))

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
  const unkept = (text: string | null, marks: Mark[]) =>
    marks.filter((mark) => mark.kind !== 'check' || !kept.has(text?.slice(mark.start, mark.end).toLowerCase() ?? ''))
  const marks = { transcript: unkept(transcript, transcriptMarks), notes: unkept(notes, notesMarks) }
  const all = [...marks.transcript, ...marks.notes]
  const anyChecks = all.some((mark) => mark.kind === 'check')

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

  function keep(word: string) {
    setKept((current) => new Set(current).add(word.toLowerCase()))
  }

  // What the student sees, folded or open: what this is and what is marked, without counting.
  const description = !hasReviewable(heard)
    ? 'WardWise could not read your recording or photos. Try again, with clearer photos or another recording.'
    : [
        'Your pack was written from this text',
        all.length > 0 ? ', with doses and drug names highlighted.' : '.',
        anyChecks ? ' Some words may have been misheard.' : '',
      ].join('')
  const preview = transcript ?? notes

  return (
    <motion.div ref={rootRef} initial="hidden" animate="show" className="scroll-mt-6">
      <Panel
        icon={ScanText}
        title="What WardWise heard and read"
        description={attention && hasReviewable(heard) ? 'Check and correct this text before WardWise writes your pack.' : description}
        aside={
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={bodyId} onClick={() => setUserOpen(!open)}>
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

        {/* Stays visible when folded too. Not shown when the check failed: the warning above says so instead. */}
        {draft.removed && draft.removed.length > 0 && !checkFailed && (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/8 p-3 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Taken out before this text was shown to you, saved or used for your pack: {listed(draft.removed)}. Each
              appears below as a tag, such as <Redacted label="name" />. Check for any it missed.
            </span>
          </p>
        )}

        {/* Folded, a glimpse of the text itself invites a look; it opens the panel. */}
        {!open && preview && (
          <button
            type="button"
            onClick={() => setUserOpen(true)}
            aria-label="Show what WardWise heard and read"
            className="group relative block w-full rounded-md text-left text-sm leading-relaxed text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <span className="line-clamp-2 [mask-image:linear-gradient(to_bottom,black_45%,transparent)]">
              <MarkedText text={preview} marks={preview === transcript ? marks.transcript : marks.notes} />
            </span>
          </button>
        )}

        <div id={bodyId} hidden={!open} className="flex flex-col gap-5">
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

          {all.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className={INK.number}>Doses and numbers</span>, <span className={INK.drug}>drug names</span>
              {anyChecks && (
                <>
                  {' '}and <span className={INK.check}>words to check</span>: tap one to fix it in a moment
                </>
              )}
              .
            </p>
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
              source="speech"
              locked={locked}
              onChange={(text) => onChange({ ...draft, transcript: text })}
              onKeep={keep}
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
              source="handwriting"
              locked={locked}
              onChange={(text) => onChange({ ...draft, notes: text })}
              onKeep={keep}
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
  source: 'speech' | 'handwriting'
  locked: boolean
  onChange: (text: string) => void
  onKeep: (word: string) => void
}

// Read with highlights, or correct in a plain text box: a text box cannot show highlights.
function TextSection({ icon: Icon, title, detail, text, original, marks, placeholder, source, locked, onChange, onKeep }: TextSectionProps) {
  const [editing, setEditing] = useState(false)
  const regionRef = useRef<HTMLDivElement>(null)
  // Writing locks the text; afterwards it opens in the read view, so the box does not grab focus on its return.
  if (locked && editing) setEditing(false)

  // The checked word disappears once fixed or kept, so focus goes back to the text.
  function settle(action: () => void) {
    action()
    regionRef.current?.focus()
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
        <div
          ref={regionRef}
          tabIndex={0}
          role="region"
          aria-label={title}
          className="ink-sweep max-h-96 overflow-y-auto rounded-lg border bg-background/60 px-4 py-3 text-[0.94rem] leading-loose whitespace-pre-wrap outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {text.trim() ? (
            <MarkedText
              text={text}
              marks={marks}
              check={(mark, word) => (
                <WordCheck
                  word={word}
                  suggestion={mark.suggestion!}
                  source={source}
                  locked={locked}
                  onFix={() => settle(() => onChange(replaceWord(text, word, mark.suggestion!)))}
                  onKeep={() => settle(() => onKeep(word))}
                />
              )}
            />
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
      )}
    </section>
  )
}

// The text with its marks. A word to check becomes a button when `check` is given; in the folded
// preview it is only marked.
function MarkedText({ text, marks, check }: { text: string; marks: Mark[]; check?: (mark: Mark, word: string) => ReactNode }) {
  const parts: ReactNode[] = []
  let at = 0
  marks.forEach((mark, order) => {
    parts.push(<Plain key={`p${at}`} text={text.slice(at, mark.start)} />)
    const word = text.slice(mark.start, mark.end)
    const style = { '--order': Math.min(order, 30) } as CSSProperties
    parts.push(
      // Only a word with a suggestion can be checked; anything else is just marked.
      mark.kind === 'check' && mark.suggestion && check ? (
        <span key={mark.start} style={style} className="contents">
          {check(mark, word)}
        </span>
      ) : (
        <mark key={mark.start} style={style} className={INK[mark.kind]}>
          {word}
        </mark>
      ),
    )
    at = mark.end
  })
  parts.push(<Plain key={`p${at}`} text={text.slice(at)} />)
  return <>{parts}</>
}

const PLACEHOLDER = /\[(name|number|place|date)\]/g

// Text between marks, with the server's placeholders drawn as small tags so they read as deliberate.
function Plain({ text }: { text: string }) {
  const pieces = text.split(PLACEHOLDER)
  if (pieces.length === 1) return <>{text}</>
  // split() with a capture group alternates text and the captured label.
  return <>{pieces.map((piece, index) => (index % 2 ? <Redacted key={index} label={piece} /> : piece))}</>
}

function Redacted({ label }: { label: string }) {
  return (
    <span className="mx-px inline-flex items-center rounded-sm bg-muted px-1.5 align-baseline font-mono text-[0.78em] leading-normal text-muted-foreground">
      {label}
    </span>
  )
}

function listed(items: string[]) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

type WordCheckProps = {
  word: string
  suggestion: string
  source: 'speech' | 'handwriting'
  locked: boolean
  onFix: () => void
  onKeep: () => void
}

// A word close to a drug name: tap it to change it to the drug, or keep it as it was.
function WordCheck({ word, suggestion, source, locked, onFix, onKeep }: WordCheckProps) {
  const question = source === 'speech' ? 'Did they say' : 'Is this'
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(INK.check, 'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40')}
          aria-label={`${word}: ${question.toLowerCase()} ${suggestion}?`}
        >
          {word}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 flex w-64 flex-col gap-3 rounded-xl border bg-popover p-3.5 text-sm text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <p>
            {question} <strong className="font-semibold text-primary">{suggestion}</strong>?
            <span className="mt-0.5 block text-xs text-muted-foreground">
              WardWise {source === 'speech' ? 'heard' : 'read'} “{word}”, which is close to this drug name.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Popover.Close asChild>
              <Button size="sm" onClick={onFix} disabled={locked}>
                Change to {suggestion}
              </Button>
            </Popover.Close>
            <Popover.Close asChild>
              <Button size="sm" variant="ghost" onClick={onKeep}>
                Keep as {source === 'speech' ? 'heard' : 'written'}
              </Button>
            </Popover.Close>
          </div>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
        className="max-h-96 min-h-32 resize-y overflow-y-auto bg-background/60 leading-relaxed"
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
