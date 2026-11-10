import { useId, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronDown, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDuration, plural } from '@/lib/format'
import { rise } from '@/lib/motion'
import type { NotePhoto, Recording } from '@/types'

type UploadsBarProps = {
  recording: Recording | null
  photos: NotePhoto[]
  open: boolean
  // A recording in progress: the recorder cannot be hidden, so the microphone is never live out of sight.
  live: boolean
  // Starting over would lose a recording, photos or corrections that no saved pack was written from.
  atRisk: boolean
  // Nothing can be cleared while recording or while WardWise is working on the inputs.
  locked: boolean
  controls: string
  onToggle: () => void
  onNewSession: () => void
}

// Once a pack is on screen, the recorder and photos fold into this bar, so the pack (and later the chat) gets the page.
export function UploadsBar({ recording, photos, open, live, atRisk, locked, controls, onToggle, onNewSession }: UploadsBarProps) {
  const [confirming, setConfirming] = useState(false)
  const confirmTextId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const newSessionRef = useRef<HTMLButtonElement>(null)

  // The dialog held focus; it goes back to the button that opened it.
  function keep() {
    setConfirming(false)
    newSessionRef.current?.focus()
  }

  function newSession() {
    if (atRisk) setConfirming(true)
    else onNewSession()
  }

  return (
    <motion.section
      variants={rise}
      aria-label="Your session"
      className="hand-radius flex flex-col gap-3 border bg-card/80 px-4 py-3 shadow-sm backdrop-blur-sm sm:px-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Upload className="size-4" aria-hidden="true" />
        </div>
        <p className="min-w-48 flex-1 text-sm">
          <span className="font-medium">Your session</span>
          <span className="text-muted-foreground"> · {live ? 'recording now' : describe(recording, photos)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            ref={toggleRef}
            size="sm"
            variant="ghost"
            onClick={onToggle}
            disabled={open && live}
            aria-expanded={open}
            aria-controls={controls}
            aria-label={open ? 'Hide recorder and photos' : 'Show recorder and photos'}
          >
            <ChevronDown className={open ? 'rotate-180 transition-transform' : 'transition-transform'} aria-hidden="true" />
            {/* Short on phones, so both buttons fit on one row. */}
            <span className="sm:hidden">{open ? 'Hide' : 'Show'}</span>
            <span className="hidden sm:inline">{open ? 'Hide recorder and photos' : 'Show recorder and photos'}</span>
          </Button>
          <Button ref={newSessionRef} size="sm" variant="outline" onClick={newSession} disabled={locked}>
            <Plus aria-hidden="true" />
            New session
          </Button>
        </div>
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-labelledby={confirmTextId}
          onKeyDown={(event) => event.key === 'Escape' && keep()}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm"
        >
          <span id={confirmTextId} className="flex-1">
            Your recording, photos or corrections are not in a saved pack yet. Starting a new session clears them.
          </span>
          <Button size="sm" variant="outline" onClick={keep} autoFocus>
            Keep them
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setConfirming(false)
              onNewSession()
              toggleRef.current?.focus()
            }}
          >
            Clear and start again
          </Button>
        </div>
      )}
    </motion.section>
  )
}

function describe(recording: Recording | null, photos: NotePhoto[]) {
  const parts: string[] = []
  if (recording) {
    parts.push(recording.durationSec === null ? 'a recording' : `a ${formatDuration(Math.round(recording.durationSec))} recording`)
  }
  if (photos.length > 0) parts.push(plural(photos.length, 'photo'))
  return parts.length > 0 ? parts.join(' and ') : 'record a round or add photos for a new pack'
}
