import { useEffect, useId, useMemo, useRef } from 'react'
import { AlertCircle, Lock, RotateCcw, Sparkles } from 'lucide-react'
import { ReadAloud } from '@/components/pack/ReadAloud'
import { Button } from '@/components/ui/button'
import { useSpeech } from '@/hooks/use-speech'
import type { HighlightsState } from '@/hooks/use-week-highlights'
import { plural } from '@/lib/format'
import { HIGHLIGHTS_LABEL, highlightsScript } from '@/lib/speech'
import type { SavedWeek } from '@/lib/storage'
import { cn } from '@/lib/utils'

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const unlockFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })

type HighlightsSectionProps = {
  state: HighlightsState
  // "This week", "Last week" or the week's date, as the sheet's title says.
  name: string
  unlocksAt: Date
  onRetry: () => void
}

export function HighlightsSection({ state, name, unlocksAt, onRetry }: HighlightsSectionProps) {
  const headingId = useId()
  const shown = 'saved' in state ? state.saved : null

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-xl border bg-accent/30 p-4">
      <h3 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        Week highlights
      </h3>

      {state.status === 'locked' && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Ready on {unlockFormat.format(unlocksAt)}, once the week's rounds are over: a short review of what mattered
          most, to read or listen to at the weekend.
        </p>
      )}
      {state.status === 'loading' && <p className="text-sm text-muted-foreground">Loading...</p>}
      {state.status === 'empty' && (
        <p className="text-sm text-muted-foreground">
          No teaching points this week that WardWise found in your material, so there is nothing to write highlights from.
        </p>
      )}

      {/* Progress and failures are announced; the highlights themselves are read on request. */}
      <div role="status" className="empty:hidden">
        {state.status === 'writing' && (
          <p className="text-sm text-muted-foreground">
            {state.saved ? "Updating your highlights to include changes to the week's sessions. " : ''}
            {state.step}...
          </p>
        )}
      </div>
      {state.status === 'error' && (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="flex items-start gap-2 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            {state.message}
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}

      {shown && (
        <Written
          // Keyed by the writing, so a new one starts the reading afresh.
          key={shown.writtenAt}
          saved={shown}
          name={name}
          outdated={state.status !== 'ready'}
        />
      )}
      {state.status === 'ready' && state.unsaved && (
        <p className="text-xs text-muted-foreground">
          Not saved in this browser ({state.unsaved}). WardWise will write them again next time.
        </p>
      )}
    </section>
  )
}

function Written({ saved, name, outdated }: { saved: SavedWeek; name: string; outdated: boolean }) {
  const { highlights } = saved
  const items = useMemo(
    () => highlightsScript(name, highlights, saved.sources.length, outdated),
    [name, highlights, saved.sources.length, outdated],
  )
  const speech = useSpeech(items)
  const spoken = speech.current === null ? null : items[speech.current]?.key
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!spoken) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current?.querySelector(`[data-spoken="${spoken}"]`)?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' })
  }, [spoken])

  const sessionName = (number: number) => {
    const source = saved.sources[number - 1]
    return source ? `${dayFormat.format(new Date(source.savedAt))} · ${source.title}` : null
  }

  return (
    <div ref={ref} className="flex flex-col gap-3">
      {outdated && (
        <p className="rounded-md border border-dashed border-warning/60 px-3 py-2 text-xs font-medium">
          These are from before the week's sessions changed.
        </p>
      )}
      <p className="text-xs text-muted-foreground">{HIGHLIGHTS_LABEL(saved.sources.length)}</p>
      <ReadAloud speech={speech} items={items} subject="highlights" />
      <ol className="flex flex-col gap-3">
        {highlights.highlights.map((highlight, index) => (
          <li
            key={index}
            data-spoken={`highlight-${index + 1}`}
            className={cn(
              'flex scroll-mt-32 flex-col gap-1.5 rounded-lg border bg-background/60 p-3 transition-colors',
              outdated && 'border-dashed',
              spoken === `highlight-${index + 1}` && 'border-primary/50 bg-accent/60',
            )}
          >
            <h4 className="text-sm font-semibold">{highlight.heading}</h4>
            <p className="text-sm leading-relaxed text-pretty">{highlight.text}</p>
            <p className="text-xs text-muted-foreground">
              {highlight.sessions.map(sessionName).filter(Boolean).join('; ')}
            </p>
            <details className="text-xs">
              <summary className="w-fit cursor-pointer rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                Based on {plural(highlight.points.length, 'teaching point')}
              </summary>
              <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                {highlight.points.map((number) => {
                  const point = saved.points[number - 1]
                  return point && <li key={number}>{point.text}</li>
                })}
              </ul>
            </details>
          </li>
        ))}
      </ol>
      {highlights.left_out > 0 && (
        <p className="text-xs text-muted-foreground">
          {plural(highlights.left_out, 'teaching point')} left out: the week had more than WardWise writes from at once.
          Each session kept its first points.
        </p>
      )}
    </div>
  )
}
