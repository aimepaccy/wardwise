import { useRef, useState } from 'react'
import { ApiError, askQuestion, messageOf, waitForJob } from '@/lib/api'
import { declinedAnswer, historyFor, keptTurns, mentionsRealPatient } from '@/lib/chat'
import { newId, type SavedPack } from '@/lib/storage'
import type { Answer, ChatTurn } from '@/types'

// An answer takes about 6 seconds; longer only when the AI allowance makes it wait.
const ASK_TIMEOUT_MS = 3 * 60_000

export type Pending = { question: string; step: string }
export type ChatError = { question: string; message: string }

// The conversation about one pack. It lives above the chat panel, so the panel can move between the dock and
// the phone sheet without losing it. `onKept` receives the turns to save with the pack after each change.
export function useChat(record: SavedPack, onKept: (turns: ChatTurn[]) => void) {
  const [turns, setTurns] = useState<ChatTurn[]>(() => record.chat ?? [])
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<ChatError | null>(null)
  // The latest turns for code that resumes after a wait, and a guard against two questions at once.
  const turnsNow = useRef(turns)
  const asking = useRef(false)

  function update(next: ChatTurn[], keep: boolean) {
    turnsNow.current = next
    setTurns(next)
    if (keep) onKept(keptTurns(next))
  }

  // If the student opens another pack meanwhile, the answer still arrives and is saved with the pack it was
  // asked about (App checks it is the same writing of that pack).
  async function ask(question: string) {
    if (asking.current) return
    setError(null)
    const add = (answer: Answer) =>
      update([...turnsNow.current, { id: newId(), question, askedAt: new Date().toISOString(), answer }], !answer.declined)
    if (mentionsRealPatient(question)) {
      add(declinedAnswer(question))
      return
    }
    asking.current = true
    setPending({ question, step: 'Sending your question' })
    try {
      const { job_id } = await askQuestion(record, question, historyFor(turnsNow.current))
      const job = await waitForJob(job_id, (step) => setPending({ question, step }), ASK_TIMEOUT_MS)
      if (!job.answer) throw new ApiError('WardWise could not answer this question.')
      add(job.answer)
    } catch (failure) {
      setError({ question, message: messageOf(failure) })
    } finally {
      asking.current = false
      setPending(null)
    }
  }

  // Removing a declined turn changes nothing saved, since it never was.
  function remove(id: string) {
    const gone = turnsNow.current.find((turn) => turn.id === id)
    if (gone) update(turnsNow.current.filter((turn) => turn.id !== id), !gone.answer.declined)
  }

  return { turns, pending, error, ask, remove }
}
