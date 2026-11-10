import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertCircle, ArrowUpFromLine, FileAudio, Loader2, Mic, Pause, Play, Square } from 'lucide-react'
import { Panel } from '@/components/Panel'
import { Sketch, Strokes } from '@/components/Sketch'
import { Button } from '@/components/ui/button'
import { useAudioRecorder, type FinishedRecording } from '@/hooks/use-audio-recorder'
import { MAX_AUDIO_MB, UPLOAD_ACCEPT, fileNameFor, isTooLarge, looksLikeAudio, readDuration } from '@/lib/audio'
import { formatDuration, formatFileSize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Recording } from '@/types'

// 32 kbps for 90 minutes is about 21 MB, safely under the 25 MB limit.
const MAX_SECONDS = 90 * 60
// How long a recording takes to wind all the tape from one reel to the other. Only for looks.
const TAPE_SECONDS = 15 * 60

type RecorderProps = {
  recording: Recording | null
  onChange: (recording: Recording | null) => void
  onLiveChange: (live: boolean) => void
}

// A cassette deck. The keys are the controls: Rec, Play, Pause, Stop and Eject.
export function Recorder({ recording, onChange, onLiveChange }: RecorderProps) {
  const mic = useAudioRecorder({ maxSeconds: MAX_SECONDS, maxBytes: MAX_AUDIO_MB * 1024 * 1024, onFinish: keep })
  const reduceMotion = useReducedMotion()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const live = mic.status === 'recording' || mic.status === 'paused' || mic.status === 'stopping'
  const view = live ? 'live' : recording ? 'done' : 'idle'
  const ready = view === 'idle' && mic.status === 'idle'

  useEffect(() => onLiveChange(live), [live, onLiveChange])

  // Listening back plays from a temporary address, released when the recording changes.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !recording) return
    const url = URL.createObjectURL(recording.file)
    audio.src = url
    return () => {
      audio.pause()
      audio.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [recording])

  function keep(result: FinishedRecording) {
    if (isTooLarge(result.blob)) {
      mic.setError(`This recording is larger than ${MAX_AUDIO_MB} MB. Please record shorter sessions.`)
      return
    }
    onChange({ file: result.blob, name: fileNameFor(result.mimeType), durationSec: result.durationSec, source: 'recorded' })
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    // A convenience check only. The server checks the file's content again.
    if (!looksLikeAudio(file)) return mic.setError(`${file.name} is not an audio file.`)
    if (isTooLarge(file)) return mic.setError(`${file.name} is larger than ${MAX_AUDIO_MB} MB.`)
    mic.setError(null)
    onChange({ file, name: file.name, durationSec: await readDuration(file), source: 'uploaded' })
  }

  function play() {
    audioRef.current?.play().catch(() => mic.setError('This recording could not be played back here.'))
  }

  function pause() {
    if (mic.status === 'recording') mic.pause()
    else if (mic.status === 'paused') mic.resume()
    else audioRef.current?.pause()
  }

  function stop() {
    if (live) return mic.stop()
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    setPosition(0)
  }

  function eject() {
    audioRef.current?.pause()
    setPlaying(false)
    setPosition(0)
    mic.setError(null)
    onChange(null)
  }

  const recordingNow = mic.status === 'recording' || mic.status === 'paused'
  const listened = playing || position > 0
  const seconds = live ? mic.elapsed : view === 'done' ? (listened ? Math.floor(position) : (recording?.durationSec ?? 0)) : 0
  const duration = recording?.durationSec ?? 0
  const wound = live ? mic.elapsed / TAPE_SECONDS : view === 'done' && duration > 0 ? position / duration : 0
  const lamp = mic.status === 'recording' ? 'rec' : mic.status === 'paused' ? 'paused' : playing ? 'play' : 'off'

  const announcements: Record<typeof mic.status, string> = {
    idle: view === 'done' ? (playing ? 'Playing back' : 'Recording ready') : '',
    starting: 'Waiting for the microphone',
    recording: 'Recording',
    paused: 'Recording paused',
    stopping: 'Finishing the recording',
  }

  const tapeLabel =
    view === 'live'
      ? 'Recording…'
      : recording
        ? recording.source === 'recorded'
          ? 'Teaching round'
          : recording.name
        : 'Blank tape'

  return (
    <Panel icon={Mic} title="Recording" description="Record the role-played round as it happens, or upload audio.">
      <p role="status" className="sr-only">
        {announcements[mic.status]}
      </p>

      <div className="rounded-2xl border border-b-4 bg-secondary/70 p-3 shadow-inner">
        <div className="flex items-center justify-between px-1 pb-2 text-[0.6rem] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
          <span>WardWise · Stereo cassette</span>
          <Lamp state={lamp} pulse={!reduceMotion} />
        </div>
        <Cassette label={tapeLabel} wound={Math.min(1, wound)} spinning={mic.status === 'recording' || playing} />
        <div className="mt-3 flex h-20 items-stretch gap-3 sm:h-24">
          <Counter seconds={seconds} />
          <VuMeter active={mic.status === 'recording'} readLevel={mic.readLevel} />
        </div>
      </div>

      <div className="mt-3 flex gap-1.5" role="group" aria-label="Recorder keys">
        <Key
          word="Rec"
          detail={mic.status === 'starting' ? 'waiting for the microphone' : 'start recording'}
          enabled={ready}
          latched={live || mic.status === 'starting'}
          onPress={() => void mic.start()}
          tone="rec"
        >
          {mic.status === 'starting' ? <Loader2 className="motion-safe:animate-spin" /> : <span className="size-3 rounded-full bg-(--vermilion)" />}
        </Key>
        <Key word="Play" detail="listen back" enabled={view === 'done' && !playing} latched={playing} onPress={play}>
          <Play className="fill-current" />
        </Key>
        <Key
          word="Pause"
          detail={mic.status === 'paused' ? 'resume recording' : recordingNow ? 'pause recording' : 'pause listening'}
          enabled={recordingNow || playing}
          latched={mic.status === 'paused'}
          pressed={recordingNow ? mic.status === 'paused' : undefined}
          onPress={pause}
        >
          <Pause className="fill-current" />
        </Key>
        <Key
          word="Stop"
          detail={live ? 'finish and keep the recording' : 'stop listening'}
          enabled={recordingNow || (view === 'done' && listened)}
          onPress={stop}
        >
          <Square className="fill-current" />
        </Key>
        <Key
          word="Eject"
          detail={recording?.source === 'uploaded' ? 'remove this file' : 'discard the recording'}
          enabled={view === 'done'}
          onPress={eject}
        >
          <ArrowUpFromLine />
        </Key>
      </div>

      <div className="mt-3 flex min-h-10 flex-col items-center gap-1 text-center">
        {view === 'idle' && (
          <p className="text-xs text-muted-foreground">
            Role-play only, never real patients. Ask everyone before you record, and keep the device near the people
            speaking.
          </p>
        )}
        {view === 'live' && (
          <p className="text-xs text-muted-foreground">
            Pause for anything off the record. Stop keeps the recording; to throw it away, stop, then eject.
          </p>
        )}
        {view === 'done' && recording && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {recording.source === 'recorded' ? 'Recording ready' : recording.name}
            {recording.durationSec !== null && ` · ${formatDuration(recording.durationSec)} long`}
            {` · ${formatFileSize(recording.file.size)}`}
          </p>
        )}
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:no-underline"
          aria-disabled={!ready}
          onClick={() => ready && fileInputRef.current?.click()}
        >
          <FileAudio /> {view === 'done' ? 'Eject first to insert an audio file' : 'Or insert an audio file'}
        </Button>
        <input ref={fileInputRef} type="file" accept={UPLOAD_ACCEPT} className="hidden" onChange={handleUpload} />
      </div>

      {/* Hidden: the keys above are its controls. */}
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onEnded={(event) => {
          event.currentTarget.currentTime = 0
          setPosition(0)
        }}
      />

      <AnimatePresence>
        {mic.error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            role="alert"
            className="overflow-hidden text-sm text-destructive"
          >
            <span className="flex items-start gap-2 pt-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {mic.error}
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </Panel>
  )
}

type KeyProps = {
  word: string
  detail: string
  enabled: boolean
  // Held down, like a key that stays in while the deck is running.
  latched?: boolean
  // For a key that toggles (Pause), screen readers announce whether it is pressed.
  pressed?: boolean
  tone?: 'rec'
  onPress: () => void
  children: ReactNode
}

// aria-disabled, not disabled: a disabled button drops keyboard focus when its state changes.
function Key({ word, detail, enabled, latched = false, pressed, tone, onPress, children }: KeyProps) {
  return (
    <button
      type="button"
      aria-label={`${word}: ${detail}`}
      aria-disabled={!enabled}
      aria-pressed={pressed}
      onClick={() => enabled && onPress()}
      className={cn(
        'flex h-15 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-t-sm rounded-b-lg border border-b-[5px] border-b-foreground/20 bg-card text-[0.6rem] font-semibold tracking-[0.15em] uppercase shadow-sm transition-all duration-100 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-3.5',
        enabled && 'hover:bg-muted active:translate-y-[3px] active:border-b-2',
        latched && 'translate-y-[3px] border-b-2 bg-muted shadow-inner',
        !enabled && !latched && 'cursor-not-allowed text-muted-foreground/60',
        !enabled && latched && 'cursor-default',
        tone === 'rec' && 'text-(--vermilion)',
      )}
    >
      {children}
      <span aria-hidden="true">{word}</span>
    </button>
  )
}

function Lamp({ state, pulse }: { state: 'rec' | 'paused' | 'play' | 'off'; pulse: boolean }) {
  const colour = { rec: 'bg-(--vermilion)', paused: 'bg-warning', play: 'bg-primary', off: 'bg-muted-foreground/30' }[state]
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      {state === 'rec' ? 'Rec' : state === 'paused' ? 'Pause' : state === 'play' ? 'Play' : 'Ready'}
      <span className="relative flex size-2">
        {state === 'rec' && pulse && (
          <motion.span
            className={cn('absolute inset-0 rounded-full', colour)}
            animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className={cn('relative size-2 rounded-full', colour)} />
      </span>
    </span>
  )
}

// The cassette as a pencil sketch, in the same hand as the other drawings.
// Shown about twice the size of the others, so its lines are drawn thinner.
const WEIGHT = 0.6

const cassette = [
  // Shell, drawn twice slightly apart, and the label.
  'M6 6 L234 5 L235 126 L5 127 Z',
  'M4 9 L232 7.5 M237 9 L235 122',
  'M18 14 L222 13 L222.5 38 L18.5 39 Z',
  // The window, and the ridge with its guide holes.
  'M64 44 L176 44 A28 28 0 0 1 176 100 L64 100 A28 28 0 0 1 64 44 Z',
  'M52 127 L62 108 L178 108 L188 127',
  'M83 118 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M117 118 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M151 118 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0',
  // Screws.
  'M11 116 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M223 116 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0',
]

const cassetteInk = [
  // The label's rule, and light on the window.
  'M26 31 L214 30.5',
  'M184 51 L198 65 M178 50 L198 70',
]

// Tape winds from the left reel to the right one as it runs.
function Cassette({ label, wound, spinning }: { label: string; wound: number; spinning: boolean }) {
  const left = 12 + 15 * (1 - wound)
  const right = 12 + 15 * wound

  return (
    <Sketch
      viewBox="0 0 240 132"
      size={1 / WEIGHT}
      className="max-h-52 w-full"
      overlay={
        <>
          <text x="26" y="26" className="fill-foreground font-ink text-[11px]">
            {label.length > 34 ? `${label.slice(0, 33)}…` : label}
          </text>
          <text x="214" y="26" textAnchor="end" className="fill-muted-foreground text-[8px] font-semibold tracking-widest">
            C-90
          </text>
        </>
      }
    >
      <Strokes paths={cassette} tone="graphite" weight={WEIGHT} />
      <Strokes paths={cassetteInk} tone="ink" start={cassette.length} weight={WEIGHT} />

      {/* The reels change size as the tape winds, so they are not drawn in stroke by stroke. */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.9 }}>
        <path
          d={`M ${82 - 0.6 * left} ${72 + 0.8 * left} L 98 104 L 142 104 L ${158 + 0.6 * right} ${72 + 0.8 * right}`}
          className="stroke-muted-foreground"
          strokeWidth={1.2 * WEIGHT}
        />
        <Reel cx={82} r={left} spinning={spinning} />
        <Reel cx={158} r={right} spinning={spinning} />
      </motion.g>
    </Sketch>
  )
}

function Reel({ cx, r, spinning }: { cx: number; r: number; spinning: boolean }) {
  return (
    <g>
      {/* The wound tape, with a second ring as a quick sketch would draw it. */}
      <circle cx={cx} cy={72} r={r} className="stroke-muted-foreground" strokeWidth={1.2 * WEIGHT} />
      <circle cx={cx} cy={72} r={Math.max(r - 2.5, 11.5)} className="stroke-muted-foreground/50" strokeWidth={WEIGHT} />
      <g
        className="animate-spin motion-reduce:animate-none"
        style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDuration: '1.8s', animationPlayState: spinning ? 'running' : 'paused' }}
      >
        <circle cx={cx} cy={72} r="10" className="stroke-primary" strokeWidth={WEIGHT} />
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <line
            key={angle}
            x1={cx}
            y1={63}
            x2={cx}
            y2={67}
            className="stroke-primary"
            strokeWidth={1.4 * WEIGHT}
            transform={`rotate(${angle} ${cx} 72)`}
          />
        ))}
        <circle cx={cx} cy={72} r="3.5" className="stroke-muted-foreground" strokeWidth={WEIGHT} />
      </g>
    </g>
  )
}

function Counter({ seconds }: { seconds: number }) {
  return (
    <div className="flex flex-col justify-center rounded-lg border bg-(--paper) px-3 py-1.5 text-foreground shadow-inner">
      <span className="text-[0.55rem] font-semibold tracking-[0.2em] uppercase opacity-60">Counter</span>
      <span className="font-mono text-2xl leading-tight tracking-wider tabular-nums">{formatDuration(seconds)}</span>
    </div>
  )
}

// A VU meter: the needle follows the real microphone level, read ten times a second.
function VuMeter({ active, readLevel }: { active: boolean; readLevel: () => number }) {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setLevel(readLevel()), 100)
    return () => window.clearInterval(id)
  }, [active, readLevel])

  const angle = -50 + 100 * (active ? level : 0)

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg border bg-(--paper) shadow-inner">
      <svg viewBox="0 0 120 52" className="h-full w-full" aria-hidden="true">
        <path d="M 29.4 24.3 A 40 40 0 0 1 76.9 13.75" className="fill-none stroke-foreground/50" strokeWidth="1.2" />
        <path d="M 76.9 13.75 A 40 40 0 0 1 90.6 24.3" className="fill-none stroke-(--vermilion)" strokeWidth="2.5" />
        {[-45, -27, -9, 9, 27, 45].map((tick) => (
          <line key={tick} x1="60" y1="4" x2="60" y2="8.5" className="stroke-foreground/50" transform={`rotate(${tick} 60 50)`} />
        ))}
        <text x="14" y="30" className="fill-muted-foreground text-[7px]">-20</text>
        <text x="96" y="30" className="fill-(--vermilion) text-[7px]">+3</text>
        <text x="60" y="40" textAnchor="middle" className="fill-muted-foreground text-[8px] font-semibold tracking-widest">VU</text>
        <motion.line
          x1="60"
          y1="50"
          x2="60"
          y2="11"
          className="stroke-foreground"
          strokeWidth="1.2"
          strokeLinecap="round"
          style={{ transformBox: 'view-box', transformOrigin: '60px 50px' }}
          animate={{ rotate: angle }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        />
        <circle cx="60" cy="50" r="3" className="fill-foreground" />
      </svg>
    </div>
  )
}
