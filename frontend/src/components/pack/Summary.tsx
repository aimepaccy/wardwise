import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'motion/react'
import { CircleCheck, Eye } from 'lucide-react'
import { ReadAloud } from '@/components/pack/ReadAloud'
import { Source } from '@/components/pack/Source'
import { useSpeech } from '@/hooks/use-speech'
import { plural } from '@/lib/format'
import { readingScript } from '@/lib/speech'
import { groupByTopic } from '@/lib/topics'
import { cn } from '@/lib/utils'
import type { StudyPack } from '@/types'

// The part being read is scrolled clear of the player at the top and the Generate bar at the bottom.
const CLEAR_OF_BAR = 'scroll-mt-32 scroll-mb-[calc(var(--bar-space,1rem)+1rem)]'

export function Summary({ pack, imported }: { pack: StudyPack; imported: boolean }) {
  // Only what is read: a quiz written later replaces the pack object, and must not stop the reading.
  const { title, overview, summary, uncovered, passage_count } = pack
  const items = useMemo(
    () => readingScript({ title, overview, summary, uncovered, passage_count }, imported),
    [title, overview, summary, uncovered, passage_count, imported],
  )
  const speech = useSpeech(items)
  const spoken = speech.current === null ? null : items[speech.current]?.key
  const ref = useRef<HTMLDivElement>(null)

  // The part being read stays in view, so the student can read along.
  useEffect(() => {
    if (!spoken) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current
      ?.querySelector(`[data-spoken="${spoken}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' })
  }, [spoken])

  return (
    <div ref={ref} className="flex flex-col gap-6">
      <ReadAloud speech={speech} items={items} />

      {pack.overview.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Overview</h3>
          {/* Prose has no quotes, so it cannot be checked word for word; the label says so. */}
          <p className="text-xs text-muted-foreground">
            Written by AI from your session. WardWise cannot check it against your material; the teaching points below
            are checked, and any WardWise cannot find in your material are marked.
          </p>
          <div className="flex flex-col gap-3 text-sm leading-relaxed">
            {pack.overview.map((paragraph, index) => (
              <p
                key={index}
                data-spoken={`overview-${index}`}
                className={cn(
                  '-mx-2 rounded-md px-2 transition-colors',
                  CLEAR_OF_BAR,
                  spoken === `overview-${index}` && 'bg-accent/70',
                )}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Key teaching points</h3>
        {/* A long round teaches several conditions, so its points sit under their topics. */}
        {groupByTopic(pack.summary).map((group, groupIndex) => (
          <div key={groupIndex} className="flex flex-col gap-2">
            {group.topic && (
              <h4 className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase first:mt-0">
                {group.topic}
              </h4>
            )}
            <ul className="flex flex-col gap-2">
              {group.points.map(({ point, number }) => (
                <motion.li
                  key={number}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: number * 0.04 }}
                  data-spoken={`point-${number}`}
                  className={cn(
                    'flex gap-3 rounded-lg border bg-background/50 p-3 text-sm leading-relaxed transition-colors',
                    CLEAR_OF_BAR,
                    spoken === `point-${number}` && 'border-primary/50 bg-accent/50',
                  )}
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[0.7rem] font-semibold text-accent-foreground">
                    {number}
                  </span>
                  <span className="flex flex-col gap-1">
                    {point.text}
                    {/* The quote stays out of sight (it still drives the checks); only a failed check is shown. */}
                    {!point.grounded && <Source quote={point.quote} grounded={false} />}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Coverage: the parts of the session no item in the pack quotes, for the student to read themselves. */}
      {pack.passage_count > 0 && (
        <section className="flex flex-col gap-2">
          {pack.uncovered.length === 0 ? (
            <p className="flex items-start gap-2 rounded-lg border bg-background/50 p-3 text-sm">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              Every part of your material is quoted at least once in the pack ({plural(pack.passage_count, 'passage')}).
            </p>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <h3 className="flex items-start gap-2 text-sm font-medium">
                <Eye className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                Parts of your session the pack does not quote ({pack.uncovered.length} of {pack.passage_count})
              </h3>
              <p className="text-sm text-muted-foreground">
                WardWise leaves out jokes and small talk. Read these yourself in case they hold teaching the pack missed.
              </p>
              <ul className="flex flex-col gap-2">
                {pack.uncovered.map((passage, index) => (
                  <li key={index} className="rounded-md border bg-background/70 p-3 text-sm leading-relaxed whitespace-pre-line">
                    {passage}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            A rough check: a quoted passage can still hold points the pack leaves out.
          </p>
        </section>
      )}
    </div>
  )
}
