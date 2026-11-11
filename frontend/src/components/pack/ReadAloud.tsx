import { useEffect, useId, useRef } from 'react'
import { Headphones, Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RATES, type useSpeech } from '@/hooks/use-speech'
import type { Spoken } from '@/lib/speech'
import { cn } from '@/lib/utils'

type ReadAloudProps = {
  speech: ReturnType<typeof useSpeech>
  items: Spoken[]
  // What is read, as in "Listen to this summary" and "sends the summary over the internet".
  subject?: string
}

// Where the reading is, in words a listener would use.
function placeOf(items: Spoken[], index: number) {
  const key = items[index]?.key ?? ''
  for (const [prefix, name] of [['point-', 'Point'], ['highlight-', 'Highlight']]) {
    if (key.startsWith(prefix)) {
      const total = items.filter((item) => item.key.startsWith(prefix)).length
      return `${name} ${key.slice(prefix.length)} of ${total}`
    }
  }
  if (key.startsWith('overview-')) return 'Overview'
  if (key === 'coverage' || key === 'left-out' || key === 'end') return 'End'
  return 'Introduction'
}

export function ReadAloud({ speech, items, subject = 'summary' }: ReadAloudProps) {
  const voiceId = useId()
  const box = useRef<HTMLDivElement>(null)
  const listenButton = useRef<HTMLButtonElement>(null)
  const playButton = useRef<HTMLButtonElement>(null)
  const idle = speech.status === 'idle'

  // The button pressed disappears when the player opens or closes, so focus moves to its counterpart rather
  // than falling back to the page, unless the student has already moved elsewhere.
  const wasIdle = useRef(idle)
  useEffect(() => {
    if (wasIdle.current === idle) return
    wasIdle.current = idle
    const active = document.activeElement
    if (active !== document.body && !box.current?.contains(active)) return
    ;(idle ? listenButton : playButton).current?.focus()
  }, [idle])

  if (!speech.supported) return null

  const playing = speech.status === 'playing'
  const nextRate = RATES[(RATES.indexOf(speech.rate) + 1) % RATES.length]
  const online = speech.voice !== null && !speech.voice.localService
  const onlineNotice = online && (
    <p className="px-1 text-xs text-muted-foreground">
      {speech.voice?.name} is an online voice: your browser sends the {subject} over the internet to be spoken.
      {speech.voices.some((voice) => voice.localService) &&
        ' Your browser lists the voices without "(online)" as voices on this device.'}
    </p>
  )

  return (
    <div
      ref={box}
      // While reading, the player stays at the top of the screen, so pausing never needs a scroll back up.
      className={cn(!idle && 'sticky top-0 z-10 flex flex-col gap-2 rounded-lg border bg-card/95 p-2 shadow-sm backdrop-blur-sm')}
    >
      {idle ? (
        <div className="flex flex-col gap-1.5">
          <Button ref={listenButton} variant="outline" size="sm" className="w-fit" onClick={speech.play}>
            <Headphones aria-hidden="true" />
            Listen to {subject === 'summary' ? 'this summary' : `the ${subject}`}
            {online && ' (online voice)'}
          </Button>
          {onlineNotice}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={() => speech.skip(-1)}>
                <SkipBack />
              </Button>
              <Button
                ref={playButton}
                variant="default"
                size="icon-sm"
                aria-label={playing ? 'Pause' : 'Resume'}
                onClick={playing ? speech.pause : speech.resume}
              >
                {playing ? <Pause /> : <Play />}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Next part" onClick={() => speech.skip(1)}>
                <SkipForward />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Stop reading" onClick={speech.stop}>
                <Square />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {speech.current !== null && placeOf(items, speech.current)}
              {!playing && ', paused'}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                className="h-8 tabular-nums sm:h-6"
                aria-label={`Speed ${speech.rate} times; change to ${nextRate} times`}
                onClick={() => speech.chooseRate(nextRate)}
              >
                {speech.rate}×
              </Button>
              {speech.voices.length > 1 && (
                <>
                  <label htmlFor={voiceId} className="sr-only">
                    Voice
                  </label>
                  <select
                    id={voiceId}
                    value={speech.voice?.voiceURI ?? ''}
                    onChange={(event) => speech.chooseVoice(event.target.value)}
                    className="h-8 max-w-44 cursor-pointer truncate rounded-md border bg-background px-1.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-6"
                  >
                    {speech.voices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name}
                        {voice.localService ? '' : ' (online)'}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
          {speech.failed && (
            <p role="alert" className="px-1 text-xs font-medium">
              Your browser could not read this with that voice. Press play to try again
              {speech.voices.length > 1 ? ', or choose another voice.' : '.'}
            </p>
          )}
          {onlineNotice}
        </>
      )}
    </div>
  )
}
