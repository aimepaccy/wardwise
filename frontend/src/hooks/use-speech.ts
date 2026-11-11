import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { englishVoices, pickVoice, type Spoken } from '@/lib/speech'
import { SpeechQueue, type QueueState } from '@/lib/speech-queue'

export const RATES = [0.8, 1, 1.25, 1.5]

const VOICE_KEY = 'wardwise-voice'
const RATE_KEY = 'wardwise-speech-rate'

// Choices are remembered in this browser only; blocked storage (a private window) just forgets them.
function readSaved(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Nothing to do: the choice still applies for this visit.
  }
}

export const speechSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

// Connects the speech queue (lib/speech-queue.ts) to React: the voices on this device, the chosen voice and
// speed, and the queue's state for the controls and the highlight.
export function useSpeech(items: Spoken[]) {
  const supported = speechSupported()
  const [state, setState] = useState<QueueState>({ status: 'idle', current: null, failed: false })
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState<string | null>(() => readSaved(VOICE_KEY))
  const [rate, setRate] = useState(() => {
    const saved = Number(readSaved(RATE_KEY))
    return RATES.includes(saved) ? saved : 1
  })

  const english = englishVoices(voices)
  const voice = pickVoice(voices, voiceURI, navigator.language)

  // The queue reads its settings when it speaks, long after the render that started it.
  const latest = useRef({ items, voice, rate })
  useLayoutEffect(() => {
    latest.current = { items, voice, rate }
  })

  const [queue] = useState(() =>
    supported
      ? new SpeechQueue(
          window.speechSynthesis,
          latest,
          (next, voiceFailed) => {
            setState(next)
            if (voiceFailed) {
              setVoiceURI(null)
              save(VOICE_KEY, '')
            }
          },
        )
      : null,
  )

  useEffect(() => {
    if (!supported) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    // Chrome lists its voices a moment after the page loads, and says so with this event.
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [supported])

  // A new pack, or leaving the summary, stops the reading.
  useEffect(() => () => queue?.stop(), [items, queue])

  // Some browsers keep talking after the page is left; a page restored from the back button shows Resume.
  useEffect(() => {
    if (!queue) return
    const leave = () => queue.pause()
    window.addEventListener('pagehide', leave)
    return () => window.removeEventListener('pagehide', leave)
  }, [queue])

  function chooseRate(next: number) {
    setRate(next)
    save(RATE_KEY, String(next))
    latest.current = { ...latest.current, rate: next }
    queue?.refresh()
  }

  function chooseVoice(uri: string) {
    setVoiceURI(uri)
    save(VOICE_KEY, uri)
    latest.current = { ...latest.current, voice: voices.find((each) => each.voiceURI === uri) ?? null }
    queue?.refresh()
  }

  return {
    supported: queue !== null,
    ...state,
    voices: english,
    voice,
    rate,
    play: () => queue?.playFrom(0),
    pause: () => queue?.pause(),
    resume: () => queue?.resume(),
    stop: () => queue?.stop(),
    skip: (by: number) => queue?.skip(by),
    chooseRate,
    chooseVoice,
  }
}
