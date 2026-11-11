import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SpeechQueue, type QueueState } from '@/lib/speech-queue'
import type { Spoken } from '@/lib/speech'

// A stand-in for the browser's utterance and speech engine, so the test decides when a sentence ends.
class FakeUtterance {
  rate = 1
  voice: SpeechSynthesisVoice | null = null
  lang = ''
  onend: (() => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  text: string
  constructor(text: string) {
    this.text = text
  }
}

const items: Spoken[] = [
  { key: 'intro', sentences: ['Title.', 'Written by AI.'] },
  { key: 'point-1', sentences: ['One.'] },
  { key: 'point-2', sentences: ['Two.', 'Two more.'] },
]

function setUp() {
  const said: FakeUtterance[] = []
  const engine = { speak: vi.fn((utterance: FakeUtterance) => said.push(utterance)), cancel: vi.fn() }
  const states: QueueState[] = []
  const voiceFailures: boolean[] = []
  const queue = new SpeechQueue(
    engine as unknown as SpeechSynthesis,
    { current: { items, voice: null, rate: 1.25 } },
    (state, voiceFailed) => {
      states.push(state)
      voiceFailures.push(voiceFailed)
    },
    // The first sentence starts at once here, instead of a tick later.
    (next) => next(),
  )
  const last = () => said.at(-1)!
  return { queue, said, engine, states, voiceFailures, last }
}

beforeEach(() => {
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
})

describe('reading aloud', () => {
  it('reads every sentence in order, then stops', () => {
    const { queue, said, last } = setUp()
    queue.playFrom(0)
    for (let i = 0; i < 5; i++) last().onend!()
    expect(said.map((utterance) => utterance.text)).toEqual(['Title.', 'Written by AI.', 'One.', 'Two.', 'Two more.'])
    expect(said[0].rate).toBe(1.25)
    expect(queue.state).toEqual({ status: 'idle', current: null, failed: false })
  })

  it('ignores the end of a sentence it has already stopped', () => {
    const { queue, said } = setUp()
    queue.playFrom(0)
    const first = said[0]
    queue.skip(1)
    first.onend!()
    first.onerror!({ error: 'interrupted' })
    expect(said.map((utterance) => utterance.text)).toEqual(['Title.', 'One.'])
    expect(queue.state.status).toBe('playing')
  })

  it('resumes at the sentence it paused on', () => {
    const { queue, said, last, engine } = setUp()
    queue.playFrom(2)
    last().onend!()
    queue.pause()
    expect(engine.cancel).toHaveBeenCalled()
    expect(queue.state.status).toBe('paused')
    queue.resume()
    expect(said.map((utterance) => utterance.text)).toEqual(['Two.', 'Two more.', 'Two more.'])
  })

  it('goes back to the start of the part being read, or to the part before', () => {
    const { queue, said, last } = setUp()
    queue.playFrom(2)
    last().onend!()
    queue.skip(-1)
    queue.skip(-1)
    expect(said.map((utterance) => utterance.text)).toEqual(['Two.', 'Two more.', 'Two.', 'One.'])
  })

  it('stops when Next is pressed on the last part', () => {
    const { queue } = setUp()
    queue.playFrom(2)
    queue.skip(1)
    expect(queue.state.status).toBe('idle')
  })

  it('pauses, not plays on silently, when something outside interrupts it', () => {
    const { queue, last } = setUp()
    queue.playFrom(1)
    last().onerror!({ error: 'interrupted' })
    expect(queue.state).toEqual({ status: 'paused', current: 1, failed: false })
  })

  it('keeps the controls and forgets the voice when the voice fails', () => {
    const { queue, last, voiceFailures } = setUp()
    queue.playFrom(0)
    last().onerror!({ error: 'network' })
    expect(queue.state).toEqual({ status: 'paused', current: 0, failed: true })
    expect(voiceFailures.at(-1)).toBe(true)
    queue.resume()
    expect(queue.state.failed).toBe(false)
  })

  it('starts the first sentence a tick after cancelling, as some engines need', () => {
    const waiting: (() => void)[] = []
    const engine = { speak: vi.fn(), cancel: vi.fn() }
    const queue = new SpeechQueue(engine as unknown as SpeechSynthesis, { current: { items, voice: null, rate: 1 } }, () => {}, (next) => waiting.push(next))
    queue.playFrom(0)
    expect(engine.speak).not.toHaveBeenCalled()
    queue.stop()
    waiting.forEach((next) => next())
    expect(engine.speak).not.toHaveBeenCalled()
  })
})
