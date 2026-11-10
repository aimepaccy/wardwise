import { useId, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, Mic, NotebookPen, ScanText, Undo2, X } from 'lucide-react'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { countWords, plural } from '@/lib/format'
import { hasCorrections, hasReviewable } from '@/lib/materials'
import type { Materials } from '@/types'

type MaterialsPanelProps = {
  // What WardWise heard and read, unchanged, and the student's corrected copy of it.
  heard: Materials
  draft: Materials
  // While WardWise writes, the text is read-only: the pack is written from the text as it was when sent.
  locked: boolean
  onChange: (draft: Materials) => void
  onClose: () => void
}

export function MaterialsPanel({ heard, draft, locked, onChange, onClose }: MaterialsPanelProps) {
  const [confirmingClose, setConfirmingClose] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const confirmTextId = useId()
  const { transcript, notes, warnings } = draft

  function requestClose() {
    if (hasCorrections(heard, draft)) setConfirmingClose(true)
    else onClose()
  }

  function keepEditing() {
    setConfirmingClose(false)
    closeRef.current?.focus()
  }

  return (
    <motion.div initial="hidden" animate="show">
      <Panel
        icon={ScanText}
        title="What WardWise heard and read"
        description={
          hasReviewable(heard)
            ? 'Correct anything WardWise got wrong. Your study pack is written from your corrected version. Transcripts and notes are read by AI and can contain mistakes.'
            : 'WardWise could not read your recording or photos. Try again, with clearer photos or another recording.'
        }
        aside={
          <Button ref={closeRef} variant="ghost" size="icon" onClick={requestClose} aria-label="Close what WardWise heard and read">
            <X />
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
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

          {warnings.length > 0 && (
            <ul className="flex flex-col gap-1.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              {warnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  {warning}
                </li>
              ))}
            </ul>
          )}

          {transcript !== null && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Mic className="size-4 text-muted-foreground" aria-hidden="true" />
                Recording transcript
                <span className="font-normal text-muted-foreground">
                  · {plural(countWords(transcript), 'word')} · AI-generated
                  {transcript !== heard.transcript && ', corrected by you'}
                </span>
              </h3>
              <EditableText
                value={transcript}
                original={heard.transcript ?? ''}
                label="Recording transcript"
                placeholder="No speech was heard."
                locked={locked}
                onChange={(text) => onChange({ ...draft, transcript: text })}
              />
            </section>
          )}

          {notes !== null && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <NotebookPen className="size-4 text-muted-foreground" aria-hidden="true" />
                Handwritten notes
                <span className="font-normal text-muted-foreground">
                  · {plural(countWords(notes), 'word')} · read by AI
                  {notes !== heard.notes && ', corrected by you'}
                </span>
              </h3>
              <EditableText
                value={notes}
                original={heard.notes ?? ''}
                label="Handwritten notes"
                placeholder="No handwriting was found."
                locked={locked}
                onChange={(text) => onChange({ ...draft, notes: text })}
              />
            </section>
          )}
        </div>
      </Panel>
    </motion.div>
  )
}

type EditableTextProps = {
  value: string
  original: string
  label: string
  placeholder?: string
  locked: boolean
  onChange: (text: string) => void
}

// Controlled: the box shows `value` and sends every change up.
function EditableText({ value, original, label, placeholder, locked, onChange }: EditableTextProps) {
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
        readOnly={locked}
        className="max-h-80 min-h-32 resize-y overflow-y-auto bg-background/60 leading-relaxed"
      />
      {value !== original && !locked && (
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
