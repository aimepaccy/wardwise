import { Fragment, useEffect, useState } from 'react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { rise } from '@/lib/motion'

const words = ['Turn', 'a', 'teaching', 'round', 'into', 'a']
const typedWord = 'study pack'

const wordStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

export function Hero() {
  return (
    <motion.section variants={wordStagger} className="max-w-3xl pt-2 sm:pt-4">
      <h1 className="font-ink text-4xl font-medium text-balance sm:text-5xl">
        {words.map((word, i) => (
          <Fragment key={i}>
            <motion.span variants={rise} className="inline-block">
              {word}
            </motion.span>{' '}
          </Fragment>
        ))}
        <motion.span variants={rise} className="inline-block">
          <Typed text={typedWord} />
        </motion.span>
      </h1>
      <motion.p variants={rise} className="mt-4 max-w-2xl text-base text-pretty text-muted-foreground">
        Press record on a role-played round, add photos of your handwritten notes, and WardWise builds a
        summary, flashcards, an exam-style quiz and further reading from credible sources.
      </motion.p>
    </motion.section>
  )
}

// Types itself out in a code font, then leaves a blinking cursor, as in a terminal.
// Screen readers get the whole text at once; the typing is only for the eyes.
function Typed({ text }: { text: string }) {
  const still = useReducedMotion()
  const [count, setCount] = useState(still ? text.length : 0)

  useEffect(() => {
    if (count >= text.length) return
    const id = window.setTimeout(() => setCount(count + 1), count === 0 ? 800 : 75)
    return () => window.clearTimeout(id)
  }, [count, text])

  const cursor = <span className="wordmark-cursor ml-[0.06em] inline-block h-[0.82em] w-[0.5em] translate-y-[0.1em] bg-primary/80" />

  return (
    <span className="font-mono text-[0.86em] font-medium tracking-tight text-primary">
      <span className="sr-only">{text}</span>
      {/* The invisible copy holds the full width, so the line does not reflow while typing. */}
      <span aria-hidden="true" className="relative inline-block whitespace-nowrap">
        <span className="invisible">
          {text}
          {cursor}
        </span>
        <span className="absolute inset-0">
          {text.slice(0, count)}
          {cursor}
        </span>
      </span>
    </span>
  )
}
