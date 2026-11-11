import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { HighlightsSection } from '@/components/HighlightsSection'
import { Quiz } from '@/components/pack/Quiz'
import { Button } from '@/components/ui/button'
import { useWeekHighlights } from '@/hooks/use-week-highlights'
import { plural } from '@/lib/format'
import { revealPack } from '@/lib/reveal'
import { StorageError, listPacks, type SavedPack } from '@/lib/storage'
import { groupByWeek, topicsOf, unlocksAt, weekKey, weekName, weekQuiz, weekRange } from '@/lib/weeks'

type WeekViewProps = {
  // Goes up by one each time App saves a pack, so an open week shows it.
  version: number
  onOpenPack: (record: SavedPack) => void
}

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const endClass = 'aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent'
const timeFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })

// The student's week: highlights once it is over, the sessions saved Monday to Friday, and a quiz mixed from
// them. The sessions and quiz are worked out from the packs in this browser each time it opens; only the
// highlights are written by the server's AI and kept (see use-week-highlights).
export function WeekView({ version, onOpenPack }: WeekViewProps) {
  const [open, setOpen] = useState(false)
  const [packs, setPacks] = useState<SavedPack[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Fixed when the sheet opens, so "this week" cannot change under the student while it is open.
  const [now, setNow] = useState(() => new Date())
  // The key of the week on screen; null for the current week. A key rather than a position in the list,
  // since the list can change while the sheet is open (a pack written again can leave an older week).
  const [shownKey, setShownKey] = useState<string | null>(null)
  const openingPack = useRef(false)
  const id = useId()

  useEffect(() => {
    if (!open) return
    let latest = true
    listPacks().then(
      (list) => {
        if (!latest) return
        setPacks(list)
        setError(null)
      },
      (failure) => {
        if (!latest) return
        setPacks([])
        setError(failure instanceof StorageError ? failure.message : 'Something went wrong. Please try again.')
      },
    )
    return () => {
      latest = false
    }
  }, [open, version])

  const weeks = useMemo(() => groupByWeek(packs ?? [], now), [packs, now])
  const current = weekKey(now)
  // A week that has since gone (its packs deleted or moved) falls back to the current week, which is always listed.
  const position = Math.max(
    weeks.findIndex((week) => week.key === (shownKey ?? current)),
    weeks.findIndex((week) => week.key === current),
  )
  const week = weeks[position]
  const earlier = weeks.at(position + 1)
  const later = position > 0 ? weeks[position - 1] : undefined
  const quiz = useMemo(() => weekQuiz(week), [week])
  // Only once the packs are read, so a week is never judged on an empty list.
  const highlights = useWeekHighlights(week, now, open && packs !== null, version)

  function changeOpen(next: boolean) {
    setOpen(next)
    if (next) {
      setNow(new Date())
      // Read afresh: deciding on the last opening's list could write highlights from a pack since deleted.
      setPacks(null)
      setShownKey(null)
      setError(null)
    }
  }

  function openPack(record: SavedPack) {
    openingPack.current = true
    onOpenPack(record)
    setOpen(false)
  }

  const name = weekName(week, now)

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" className="rounded-full max-sm:px-2.5">
          <CalendarDays aria-hidden="true" />
          {/* Icon only on phones, where the header has no room; screen readers still hear the name. */}
          <span className="max-sm:sr-only">This week</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            if (!openingPack.current) return
            openingPack.current = false
            event.preventDefault()
            revealPack()
          }}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l bg-card shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right motion-reduce:animate-none"
        >
          <header className="flex items-start gap-3 border-b p-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold">{name}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">{weekRange(week)}</Dialog.Description>
            </div>
            {/* aria-disabled rather than disabled, so a button that reaches the end keeps keyboard focus. */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Earlier week"
              aria-disabled={!earlier}
              className={endClass}
              onClick={() => earlier && setShownKey(earlier.key)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Later week"
              aria-disabled={!later}
              className={endClass}
              onClick={() => later && setShownKey(later.key)}
            >
              <ChevronRight />
            </Button>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X />
              </Button>
            </Dialog.Close>
          </header>

          {/* The title changes with the arrows, but titles are not announced; this is. */}
          <p role="status" className="sr-only">
            {packs !== null && shownKey !== null && `${name}, ${weekRange(week)}`}
          </p>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {packs === null ? (
              <p className="text-sm text-muted-foreground">Loading your week...</p>
            ) : week.packs.length === 0 ? (
              // Only the current week can be empty: every other week is listed because it has packs.
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No sessions saved this week yet. Packs you write appear here, grouped Monday to Friday.
              </p>
            ) : (
              <>
                <HighlightsSection state={highlights.state} name={name} unlocksAt={unlocksAt(week)} onRetry={highlights.retry} />

                <section aria-labelledby={`${id}-sessions`} className="flex flex-col gap-2">
                  <h3 id={`${id}-sessions`} className="text-sm font-semibold">
                    {plural(week.packs.length, 'session')}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {week.packs.map((record) => {
                      const topics = topicsOf(record)
                      return (
                        <li key={record.id}>
                          <button
                            type="button"
                            onClick={() => openPack(record)}
                            className="w-full cursor-pointer rounded-lg border bg-background/50 p-3 text-left outline-none hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          >
                            <span className="block text-xs text-muted-foreground">
                              {timeFormat.format(new Date(record.savedAt))}
                              {record.origin === 'imported' && ' · Imported'}
                            </span>
                            <span className="block text-sm font-medium">{record.pack.title}</span>
                            {/* One topic usually repeats the title, so topics are listed only when there are several. */}
                            {topics.length > 1 && (
                              <span className="block text-xs text-muted-foreground">{topics.join(', ')}</span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>

                <section aria-labelledby={`${id}-quiz`} className="flex flex-col gap-3">
                  <div>
                    <h3 id={`${id}-quiz`} className="text-sm font-semibold">
                      Quiz from the week
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {quiz.length > 0
                        ? `${plural(quiz.length, 'question')} written by AI, mixed from your sessions. Only questions whose quote WardWise found in your material.`
                        : 'None of these sessions has a question whose quote WardWise found in your material.'}
                    </p>
                  </div>
                  {quiz.length > 0 && (
                    // Keyed by the questions themselves, so any change to them (another week, a pack written again,
                    // a quiz added to a pack) starts afresh rather than keeping answers given to other questions.
                    <Quiz
                      key={quiz
                        .map(({ from, question }) => `${from.id}@${from.savedAt}#${from.pack.questions.indexOf(question)}`)
                        .join(',')}
                      questions={quiz.map(({ question }) => question)}
                      sources={quiz.map(({ from }) => `${dayFormat.format(new Date(from.savedAt))} · ${from.pack.title}`)}
                      fullMarksHint="Every one right. A good week's work."
                    />
                  )}
                </section>
              </>
            )}
          </div>

          <footer className="border-t p-5 text-xs text-muted-foreground">
            Worked out from the packs saved in this browser. Only the highlights are written on WardWise's server, from
            the week's teaching points; it keeps nothing.
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
