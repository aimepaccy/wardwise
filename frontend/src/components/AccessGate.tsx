import { useEffect, useId, useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { accessCode, forgetCode, onCodeNeeded, rememberCode } from '@/lib/access'
import { ApiError, checkCode, messageOf } from '@/lib/api'

type Reason = 'start' | 'refused'

// Asks for the access code on a hosted copy: when the page opens without a working code, and whenever the
// server turns a request away for want of one. It can be put aside, since saved packs open without the server.
export function AccessGate({ required }: { required: boolean }) {
  const [reason, setReason] = useState<Reason | null>(null)
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()

  useEffect(() => onCodeNeeded(() => setReason('refused')), [])

  // A remembered code is checked once on arrival, so a changed code is asked for before any work starts.
  useEffect(() => {
    if (!required) return
    const saved = accessCode()
    if (!saved) {
      setReason('start')
      return
    }
    let current = true
    checkCode(saved).catch((failure) => {
      if (!current || !(failure instanceof ApiError) || failure.status !== 401) return
      forgetCode()
      setReason('start')
    })
    return () => {
      current = false
    }
  }, [required])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const typed = code.trim()
    if (!typed) return
    setChecking(true)
    setError(null)
    try {
      await checkCode(typed)
      rememberCode(typed)
      setReason(null)
      setCode('')
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setChecking(false)
    }
  }

  return (
    <Dialog.Root open={reason !== null} onOpenChange={(open) => !open && setReason(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none">
          <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <Dialog.Title className="font-ink text-xl font-semibold">Enter the access code</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            This copy of WardWise is shared by invitation. Enter the code you were given
            {reason === 'refused' ? ', then send again.' : '. This browser will remember it.'}
          </Dialog.Description>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Access code
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={200}
                aria-invalid={error !== null}
                aria-describedby={error ? errorId : undefined}
                className="h-10 rounded-md border bg-background px-3 text-base font-normal outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
              />
            </label>
            {error && (
              <p id={errorId} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-1 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">
                  Not now
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={checking || !code.trim()}>
                {checking ? 'Checking…' : 'Continue'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
