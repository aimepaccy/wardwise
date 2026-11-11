import { useId, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  BookMarked,
  ExternalLink,
  FileText,
  GitCompareArrows,
  NotebookPen,
  SearchX,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import { NOT_ANSWERED, findQuote, sourceLink } from '@/lib/chat'
import { cn } from '@/lib/utils'
import type { Answer, AnswerPart, AnswerSource, SourceKind } from '@/types'

const KINDS: Record<SourceKind, { label: string; icon: LucideIcon; from: string; site: string }> = {
  session: { label: 'Your session', icon: NotebookPen, from: '', site: '' },
  pubmed: { label: 'PubMed', icon: FileText, from: "From the article's abstract", site: 'PubMed' },
  // WardWise reads a chapter's summary on PubMed, not the chapter itself, and says so.
  statpearls: { label: 'StatPearls', icon: BookMarked, from: "From the chapter's summary on PubMed", site: 'NCBI Bookshelf' },
}

type AnswerViewProps = { answer: Answer; asked: string; imported: boolean }

export function AnswerView({ answer, asked, imported }: AnswerViewProps) {
  if (answer.declined) {
    return (
      <Notice icon={ShieldAlert}>
        WardWise answers questions about the teaching, not about a real patient's care, so it did not search or
        answer this. This question is not saved with the pack.
      </Notice>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {answer.parts.length === 0 && (
        <Notice icon={SearchX}>{NOT_ANSWERED} Try asking again with the drug, test or condition named.</Notice>
      )}
      {answer.disagree && (
        <Notice icon={GitCompareArrows} warning>
          Your session and the literature differ here. Ward teaching can follow local practice for good reasons, so
          ask your teacher which applies.
        </Notice>
      )}
      {answer.parts.map((part, index) => (
        <Part key={index} part={part} sources={answer.sources} group={answer.group} imported={imported} />
      ))}
      {answer.notes.length > 0 && <p className="text-xs text-muted-foreground">{answer.notes.join(' ')}</p>}
      <HowAnswered answer={answer} asked={asked} />
    </div>
  )
}

function Part({ part, sources, group, imported }: { part: AnswerPart; sources: AnswerSource[]; group: string; imported: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  const panelId = useId()
  const cited = part.sources.flatMap((number) => sources.filter((source) => source.number === number))
  const shown = cited.find((source) => source.number === open)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-relaxed">{part.text}</p>
      {part.group_unclear && (
        <Flag>Not stated for {group}: the source does not say whether this applies. Check before you rely on it there.</Flag>
      )}
      {!part.grounded && <Flag>WardWise could not find the quoted words in the sources it cites. Check it before you rely on it.</Flag>}
      {part.grounded && cited[0]?.kind === 'session' && (
        <p className="text-xs text-muted-foreground italic">From your session: "{part.quote}"</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {cited.map((source) => {
          const { icon: Icon } = KINDS[source.kind]
          // "Your recording" or "Your notes" for the session, so two session chips can be told apart.
          const label = source.kind === 'session' ? source.title : KINDS[source.kind].label
          const isOpen = source.number === open
          return (
            <button
              key={source.number}
              type="button"
              aria-expanded={isOpen}
              aria-controls={isOpen ? panelId : undefined}
              aria-label={`Source ${source.number}, ${label}: ${isOpen ? 'hide' : 'show'} the passage`}
              onClick={() => setOpen(isOpen ? null : source.number)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                source.kind === 'session'
                  ? 'border-primary/30 bg-accent text-accent-foreground hover:border-primary/60'
                  : 'bg-secondary text-secondary-foreground hover:border-primary/40',
                isOpen && 'border-primary',
              )}
            >
              <span className="tabular-nums opacity-70">{source.number}</span>
              <Icon className="size-3" aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>

      {shown && <SourcePanel id={panelId} source={shown} quote={part.quote} imported={imported} />}
    </div>
  )
}

function SourcePanel({ id, source, quote, imported }: { id: string; source: AnswerSource; quote: string; imported: boolean }) {
  const { from, site } = KINDS[source.kind]
  const link = sourceLink(source.url)
  return (
    <div id={id} className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-3 text-xs">
      {source.kind !== 'session' && (
        <div>
          <p className="font-medium text-foreground">{source.title}</p>
          {source.detail && <p className="text-muted-foreground">{source.detail}</p>}
        </div>
      )}
      <p className="text-muted-foreground">
        {imported ? 'As saved in the imported file' : source.kind === 'session' ? `From ${source.title.toLowerCase()}` : from}:
      </p>
      {source.passages.map((passage, index) => (
        <blockquote
          key={index}
          className="max-h-48 overflow-y-auto border-l-2 border-primary/30 pl-2.5 leading-relaxed whitespace-pre-line text-foreground/85"
        >
          <Highlighted text={passage} quote={quote} />
        </blockquote>
      ))}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex w-fit items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          Open on {site}
          <ExternalLink className="size-3" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </div>
  )
}

function Highlighted({ text, quote }: { text: string; quote: string }) {
  const at = findQuote(text, quote)
  if (!at) return text
  return (
    <>
      {text.slice(0, at.start)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">{text.slice(at.start, at.end)}</mark>
      {text.slice(at.end)}
    </>
  )
}

function HowAnswered({ answer, asked }: { answer: Answer; asked: string }) {
  const rewritten = answer.question.trim().toLowerCase() !== asked.trim().toLowerCase()
  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="w-fit cursor-pointer rounded outline-none select-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
        How WardWise answered
      </summary>
      <dl className="mt-2 grid gap-1.5 border-l-2 pl-3">
        {rewritten && (
          <div>
            <dt className="inline font-medium text-foreground">Understood as: </dt>
            <dd className="inline">{answer.question}</dd>
          </div>
        )}
        <div>
          <dt className="inline font-medium text-foreground">Literature searched for: </dt>
          <dd className="inline">{answer.searched.length > 0 ? answer.searched.join('; ') : 'nothing this time'}</dd>
        </div>
        {answer.model && (
          <div>
            <dt className="inline font-medium text-foreground">Written by: </dt>
            <dd className="inline">{answer.model}, an AI model told to use only the numbered sources. It can make mistakes.</dd>
          </div>
        )}
      </dl>
    </details>
  )
}

function Notice({ icon: Icon, warning = false, children }: { icon: LucideIcon; warning?: boolean; children: ReactNode }) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg border p-3 text-sm',
        warning ? 'border-warning/40 bg-warning/5' : 'bg-muted/40 text-muted-foreground',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', warning ? 'text-warning' : 'text-muted-foreground')} aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

function Flag({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs font-medium">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
