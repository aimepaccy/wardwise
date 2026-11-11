import type { Spoken } from '@/lib/speech'

export type SpeechStatus = 'idle' | 'playing' | 'paused'
export type QueueState = { status: SpeechStatus; current: number | null; failed: boolean }
export type QueueSettings = { items: Spoken[]; voice: SpeechSynthesisVoice | null; rate: number }

// Errors that mean this voice cannot be used now (an online voice with no network, a voice removed), so the
// choice is forgotten and the next try uses a voice on the device.
const VOICE_FAILURES = new Set(['network', 'synthesis-unavailable', 'voice-unavailable', 'language-unavailable'])

// Reads items aloud through the browser's speech engine, one sentence at a time. Plain TypeScript with no
// React, so the timing logic can be tested with a stand-in engine.
//
// Pausing cancels and remembers the sentence, since pause() is unreliable on some phones; resuming starts
// that sentence again. Each start gets a new run number: events from an utterance WardWise stopped carry an
// old one and are ignored.
export class SpeechQueue {
  state: QueueState = { status: 'idle', current: null, failed: false }
  // The sentence being spoken, held so the browser does not discard it before it ends (Chrome then never
  // says it ended).
  speaking: SpeechSynthesisUtterance | null = null
  private run = 0
  private position = { item: 0, sentence: 0 }
  private engine: Pick<SpeechSynthesis, 'speak' | 'cancel'>
  // A ref, read when each sentence starts, so a new speed or voice is used from the next one.
  private settings: { readonly current: QueueSettings }
  private report: (state: QueueState, voiceFailed: boolean) => void
  private later: (next: () => void) => void

  constructor(
    engine: Pick<SpeechSynthesis, 'speak' | 'cancel'>,
    settings: { readonly current: QueueSettings },
    report: (state: QueueState, voiceFailed: boolean) => void,
    // Some engines drop a speak() that comes straight after cancel(), so the first sentence waits a tick.
    later: (next: () => void) => void = (next) => setTimeout(next, 0),
  ) {
    this.engine = engine
    this.settings = settings
    this.report = report
    this.later = later
  }

  playFrom(item: number, sentence = 0) {
    const { items } = this.settings.current
    if (items.length === 0) return
    this.halt()
    this.position = { item: Math.max(0, Math.min(item, items.length - 1)), sentence }
    this.emit({ status: 'playing', current: this.position.item, failed: false })
    const token = this.run
    this.later(() => this.sayNext(token))
  }

  pause() {
    if (this.state.status !== 'playing') return
    this.halt()
    this.emit({ status: 'paused' })
  }

  resume() {
    this.playFrom(this.position.item, this.position.sentence)
  }

  // Back restarts the part being read if it is under way, as music players do; past the last part, stop.
  skip(by: number) {
    const { item, sentence } = this.position
    if (by < 0 && sentence > 0) return this.playFrom(item)
    if (item + by >= this.settings.current.items.length) return this.stop()
    this.playFrom(item + by)
  }

  stop() {
    this.halt()
    this.position = { item: 0, sentence: 0 }
    this.emit({ status: 'idle', current: null, failed: false })
  }

  // A new speed or voice takes effect from the sentence being read.
  refresh() {
    if (this.state.status === 'playing') this.resume()
  }

  private halt() {
    this.run += 1
    this.speaking = null
    this.engine.cancel()
  }

  private emit(changes: Partial<QueueState>, voiceFailed = false) {
    this.state = { ...this.state, ...changes }
    this.report(this.state, voiceFailed)
  }

  private sayNext(token: number) {
    if (token !== this.run) return
    const { items, voice, rate } = this.settings.current
    const { item, sentence } = this.position
    if (item >= items.length) {
      this.speaking = null
      this.position = { item: 0, sentence: 0 }
      this.emit({ status: 'idle', current: null })
      return
    }
    if (sentence >= items[item].sentences.length) {
      this.position = { item: item + 1, sentence: 0 }
      this.sayNext(token)
      return
    }
    if (this.state.current !== item) this.emit({ current: item })

    const utterance = new SpeechSynthesisUtterance(items[item].sentences[sentence])
    utterance.rate = rate
    if (voice) utterance.voice = voice
    // Android writes "en_GB"; the standard form is "en-GB".
    utterance.lang = (voice?.lang ?? 'en').replace('_', '-')
    utterance.onend = () => {
      if (token !== this.run) return
      this.position = { item, sentence: sentence + 1 }
      this.sayNext(token)
    }
    utterance.onerror = (event) => {
      if (token !== this.run) return
      this.run += 1
      this.speaking = null
      // WardWise always changes the run number before it cancels, so an interruption that still carries the
      // current one came from outside (a call, another app): pause, and Resume repeats the sentence. Any
      // other error is a failure the student is told about, with the controls kept to choose another voice.
      const fromOutside = event.error === 'interrupted' || event.error === 'canceled'
      this.emit({ status: 'paused', failed: !fromOutside }, VOICE_FAILURES.has(event.error))
    }
    this.speaking = utterance
    this.engine.speak(utterance)
  }
}
