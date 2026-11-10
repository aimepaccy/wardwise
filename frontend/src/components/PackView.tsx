import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, BookOpenCheck, Check, Download, Layers, Library, ListChecks, Loader2, NotebookText } from 'lucide-react'
import { Tabs } from 'radix-ui'
import { Panel } from '@/components/Panel'
import { Flashcards } from '@/components/pack/Flashcards'
import { FurtherReading } from '@/components/pack/FurtherReading'
import { Quiz } from '@/components/pack/Quiz'
import { Summary } from '@/components/pack/Summary'
import { WriteQuiz } from '@/components/pack/WriteQuiz'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useReading } from '@/hooks/use-reading'
import { downloadFile, exportName } from '@/lib/download'
import { revealPack } from '@/lib/reveal'
import { exportBlob, type SavedPack } from '@/lib/storage'
import type { Question } from '@/types'

export type SaveStatus =
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'failed'; message: string }
  // The pack is saved, but the quiz written for it later is not.
  | { status: 'quiz-failed'; message: string }

type PackViewProps = {
  record: SavedPack
  save: SaveStatus
  onQuizWritten: (record: SavedPack, questions: Question[]) => void
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function PackView({ record, save, onQuizWritten }: PackViewProps) {
  const { pack } = record
  const [tab, setTab] = useState('summary')
  const reading = useReading()

  // Opening Further reading for the first time looks up the first term. Starting it from the click,
  // not from an effect, means nothing is fetched for a tab that is never opened.
  function openTab(value: string) {
    setTab(value)
    if (value === 'reading' && reading.chosen === null && pack.search_terms.length > 0) {
      reading.choose(pack.search_terms[0])
    }
  }

  // Scroll down to the new pack and tell screen reader users it has arrived, unless the student is typing:
  // pulling the page away mid-sentence would lose their place.
  useEffect(() => {
    const active = document.activeElement
    if (!(active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)) revealPack()
  }, [pack])

  const tabs = [
    { value: 'summary', label: 'Summary', icon: NotebookText, count: null },
    { value: 'cards', label: 'Flashcards', icon: Layers, count: pack.flashcards.length },
    // Never disabled: a pack without a quiz offers to write one.
    { value: 'quiz', label: 'Quiz', icon: ListChecks, count: pack.questions.length || null },
    { value: 'reading', label: 'Reading', icon: Library, count: pack.search_terms.length },
  ]

  return (
    <motion.div id="pack" initial="hidden" animate="show" className="scroll-mt-6">
      <Panel
        icon={BookOpenCheck}
        title={pack.title}
        description={
          record.origin === 'imported'
            ? 'Imported from a file. WardWise checked its quotes against the material in the file, but cannot confirm where that material came from.'
            : 'Your study pack, written by AI from your session. Check it against trusted sources.'
        }
        aside={
          // Works even when saving failed: the pack is still in memory.
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Export this pack"
                onClick={() => downloadFile(exportBlob([record]), exportName(pack.title))}
              >
                <Download />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export this pack</TooltipContent>
          </Tooltip>
        }
      >
        {(save.status === 'failed' || save.status === 'quiz-failed') && (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <span>
              {save.status === 'failed' ? 'This pack is not saved.' : 'The pack is saved, but its new quiz is not.'} {save.message}{' '}
              Export it now to keep a copy.
            </span>
          </p>
        )}
        <div id="pack-start" tabIndex={-1} role="region" aria-label={`Study pack: ${pack.title}`} className="outline-none">
          {/* Radix gives the tabs their roles and arrow-key movement; we only style them. */}
          <Tabs.Root value={tab} onValueChange={openTab} className="flex flex-col gap-5">
            <Tabs.List aria-label="Parts of the study pack" className="flex gap-1 rounded-lg bg-muted p-1">
              {tabs.map(({ value, label, icon: Icon, count }) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  disabled={count === 0}
                  className="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm sm:gap-2 sm:px-3 font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  {/* No icons or counts on phones: four labels already fill the row. */}
                  <Icon className="hidden size-4 sm:block" aria-hidden="true" />
                  {label}
                  {count !== null && <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{count}</span>}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="summary" className="outline-none">
              <Summary pack={pack} />
            </Tabs.Content>

            {/* Kept mounted while hidden, so switching tabs does not lose the place in the cards or the quiz.
                Cards and reading are left out when empty (thin material can give none); the quiz never is. */}
            {pack.flashcards.length > 0 && (
              <Tabs.Content value="cards" forceMount className="outline-none data-[state=inactive]:hidden">
                <Flashcards cards={pack.flashcards} />
              </Tabs.Content>
            )}

            <Tabs.Content value="quiz" forceMount className="outline-none data-[state=inactive]:hidden">
              {pack.questions.length > 0 ? (
                <Quiz questions={pack.questions} />
              ) : (
                <WriteQuiz record={record} onWritten={(questions) => onQuizWritten(record, questions)} />
              )}
            </Tabs.Content>

            {pack.search_terms.length > 0 && (
              <Tabs.Content value="reading" forceMount className="outline-none data-[state=inactive]:hidden">
                <FurtherReading
                  terms={pack.search_terms}
                  chosen={reading.chosen}
                  lookup={reading.lookup}
                  onChoose={reading.choose}
                />
              </Tabs.Content>
            )}
          </Tabs.Root>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <p>
              AI-generated by {pack.model}, {dateFormat.format(new Date(record.savedAt))}. It can contain mistakes.
            </p>
            <p role="status" className="flex items-center gap-1.5">
              {save.status === 'saving' && (
                <>
                  <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
                  Saving
                </>
              )}
              {save.status === 'saved' && (
                <>
                  <Check className="size-3.5 text-primary" aria-hidden="true" />
                  Saved in this browser
                </>
              )}
            </p>
          </div>
        </div>
      </Panel>
    </motion.div>
  )
}
