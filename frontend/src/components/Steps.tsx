import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'

export type StepKey = 'upload' | 'read' | 'write' | 'check'

const LABELS: Record<StepKey, string> = { upload: 'Upload', read: 'Read', check: 'Check', write: 'Write' }

type StepsProps = {
  steps: StepKey[]
  // The step in progress, or 'done' when every step is finished.
  current: StepKey | 'done'
  // True while WardWise is working on the current step (not waiting for the student).
  busy: boolean
}

export function Steps({ steps, current, busy }: StepsProps) {
  const position = current === 'done' ? steps.length : steps.indexOf(current)
  // With reduced motion the pulse would still blink forever, so it is left out.
  const pulse = !useReducedMotion()

  return (
    <ol className="flex items-center gap-1.5 text-xs" aria-label="Progress">
      {steps.map((step, index) => {
        const finished = index < position
        const active = index === position
        return (
          <li key={step} className="flex items-center gap-1.5" aria-current={active ? 'step' : undefined}>
            {index > 0 && (
              <span className={cn('h-px w-4 sm:w-6', finished || active ? 'bg-primary' : 'bg-border')} aria-hidden="true" />
            )}
            <motion.span
              layout
              transition={spring}
              className={cn(
                'relative grid size-5 place-items-center rounded-full border text-[0.65rem] font-semibold',
                finished && 'border-primary bg-primary text-primary-foreground',
                active && 'border-primary text-primary',
                !finished && !active && 'text-muted-foreground',
              )}
            >
              {finished ? <Check className="size-3" aria-hidden="true" /> : index + 1}
              {active && busy && pulse && (
                <motion.span
                  aria-hidden="true"
                  className="absolute size-5 rounded-full border border-primary"
                  animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
              )}
            </motion.span>
            <span className={cn(active ? 'font-medium text-foreground' : 'text-muted-foreground', !active && 'sr-only sm:not-sr-only')}>
              {LABELS[step]}
              {finished && <span className="sr-only"> (done)</span>}
              {/* A new key for each step gives a fresh timer starting at zero. */}
              {active && busy && <Elapsed key={step} />}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// Seconds on the current step, shown after the first few. Timestamps, not counted ticks (see phase 3a).
function Elapsed() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [])

  return seconds >= 3 ? <span className="text-muted-foreground tabular-nums"> {seconds} s</span> : null
}
