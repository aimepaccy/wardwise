import { useId, useState } from 'react'
import { motion } from 'motion/react'
import { LoaderCircle, MessagesSquare, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { Chat } from '@/components/ask/Chat'
import { Button } from '@/components/ui/button'
import { useChat } from '@/hooks/use-chat'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { SavedPack } from '@/lib/storage'
import type { ChatTurn } from '@/types'

// Tailwind's `md`: tablets and up get the chat docked beside the pack; phones get a full-height sheet.
const DOCKED = '(min-width: 768px)'

const DESCRIPTION = 'AI-written answers from your session and the literature, each part with its source.'

type AskDockProps = {
  record: SavedPack
  onKept: (record: SavedPack, turns: ChatTurn[]) => void
}

// One conversation, two places to show it. The conversation and the unsent question live here, above both,
// so turning a tablet or closing the sheet loses neither.
export function AskDock({ record, onKept }: AskDockProps) {
  const chat = useChat(record, (turns) => onKept(record, turns))
  const docked = useMediaQuery(DOCKED)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  // Answers seen in the sheet, so one that arrives while it is closed can be pointed out.
  const [seen, setSeen] = useState(chat.turns.length)
  const titleId = useId()
  // Turned to tablet width, the dock takes over; the sheet should not reopen when the phone is turned back.
  if (docked && open) setOpen(false)
  if (open && seen !== chat.turns.length) setSeen(chat.turns.length)
  const unread = !open && chat.turns.length > seen

  // Search terms are index-style ("magnesium sulphate asthma"), so only the first, usually the topic, reads well here.
  const topic = record.pack.search_terms[0]
  const suggestions = topic ? [`What did the session teach about ${topic}?`, `What does the literature add on ${topic}?`] : []
  const shared = {
    ...chat,
    imported: record.origin === 'imported',
    onAsk: chat.ask,
    onRemove: chat.remove,
    suggestions,
    draft,
    onDraftChange: setDraft,
  }

  if (docked) {
    // Held clear of the Generate bar, which stays at the bottom of the screen (GenerateBar sets --bar-space).
    return (
      <motion.aside
        aria-labelledby={titleId}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="hand-radius sticky top-4 flex h-[calc(100dvh-var(--bar-space,1rem)-1.75rem)] min-h-104 flex-col border bg-card/80 shadow-sm backdrop-blur-sm"
      >
        <Chat
          {...shared}
          title={
            <h2 id={titleId} className="font-ink text-[1.05rem] leading-snug font-semibold">
              Ask about this session
            </h2>
          }
          description={<p className="text-sm text-muted-foreground">{DESCRIPTION}</p>}
        />
      </motion.aside>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* The chat's own announcements are inside the sheet, so while it is closed this one says an answer came. */}
      <p role="status" className="sr-only">
        {unread ? 'Your answer is ready. Open Ask to read it.' : ''}
      </p>
      <Dialog.Trigger asChild>
        <Button
          aria-label={
            chat.pending
              ? 'Ask about this session (an answer is on its way)'
              : unread
                ? 'Ask about this session (a new answer)'
                : 'Ask about this session'
          }
          className="fixed right-4 bottom-[calc(var(--bar-space,1rem)+0.75rem)] z-30 h-11 rounded-full px-5 shadow-lg"
        >
          {chat.pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <MessagesSquare aria-hidden="true" />}
          Ask
          {unread && <span className="absolute top-1.5 right-2 size-2.5 rounded-full bg-gold ring-2 ring-primary" aria-hidden="true" />}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content className="fixed inset-0 z-50 flex h-dvh flex-col bg-card outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom motion-reduce:animate-none">
          <Chat
            {...shared}
            title={<Dialog.Title className="text-base font-semibold">Ask about this session</Dialog.Title>}
            description={<Dialog.Description className="text-sm text-muted-foreground">{DESCRIPTION}</Dialog.Description>}
            close={
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Close">
                  <X />
                </Button>
              </Dialog.Close>
            }
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
