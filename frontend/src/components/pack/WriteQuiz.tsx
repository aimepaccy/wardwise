import { useState } from 'react'
import { AlertCircle, ListChecks, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError, waitForJob, writeQuiz } from '@/lib/api'
import type { SavedPack } from '@/lib/storage'
import type { Question } from '@/types'

type State = { status: 'idle' } | { status: 'writing'; step: string } | { status: 'error'; message: string }

// Every pack should have a quiz. When one came without (the AI's answer was unusable after three tries, the
// service was busy, or thin material gave no questions), the student can have it written here, from the pack's points.
export function WriteQuiz({ record, onWritten }: { record: SavedPack; onWritten: (questions: Question[]) => void }) {
  const [state, setState] = useState<State>({ status: 'idle' })

  async function write() {
    setState({ status: 'writing', step: 'Sending to WardWise' })
    try {
      const { job_id } = await writeQuiz(record)
      const job = await waitForJob(job_id, (step) => setState({ status: 'writing', step }))
      if (!job.questions?.length) throw new ApiError('WardWise could not write the quiz this time. Please try again.')
      onWritten(job.questions)
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Something went wrong. Please try again.' })
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <ListChecks className="size-6" aria-hidden="true" />
      </div>
      <p className="text-lg font-semibold">This pack has no quiz yet.</p>
      <p className="max-w-md text-sm text-muted-foreground">
        WardWise could not write it with the rest of the pack. It can write it now from the pack's teaching points, which
        takes about a minute.
      </p>
      {state.status === 'error' && (
        <p role="alert" className="flex max-w-md items-start gap-2 text-left text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          {state.message}
        </p>
      )}
      <Button onClick={write} disabled={state.status === 'writing'}>
        {state.status === 'writing' ? <Loader2 className="motion-safe:animate-spin" /> : <ListChecks />}
        {state.status === 'error' ? 'Try again' : 'Write the quiz'}
      </Button>
      <p role="status" className="text-xs text-muted-foreground">
        {state.status === 'writing' && state.step}
      </p>
    </div>
  )
}
