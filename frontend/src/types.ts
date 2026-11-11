// A photo of handwritten notes. The order they were added is the order of the pages.
export type NotePhoto = {
  id: string
  file: File
}

export type Recording = {
  file: Blob
  name: string
  // Unknown when an uploaded file does not say how long it is.
  durationSec: number | null
  source: 'recorded' | 'uploaded'
}

// Mirrors SessionReceipt in backend/app/schemas.py.
export type SessionReceipt = {
  audio: { name: string; kind: string; size_bytes: number } | null
  photos: { name: string; kind: string; size_bytes: number }[]
}

// Mirrors JobCreated, Materials and JobState in backend/app/schemas.py.
export type JobCreated = {
  job_id: string
  receipt: SessionReceipt
}

// Mirrors Limits in backend/app/schemas.py.
export type Limits = {
  max_audio_mb: number
  max_photos: number
  max_photo_mb: number
  max_pack_words: number
  max_pack_chars: number
  // Up to this, a pack is written in under a minute; longer sessions are condensed first and take minutes.
  quick_pack_chars: number
}

// How much text a study pack would be written from, in characters (as the server measures it).
export type PackSize = { chars: number; empty: boolean }

export type Materials = {
  transcript: string | null
  // Handwritten notes as WardWise read them from the photos.
  notes: string | null
  warnings: string[]
}

// Mirrors StudyPack in backend/app/schemas.py. `grounded` is WardWise's check that the quote is really in the material.
// Packs written before 2026-11-10 have no topic.
export type TeachingPoint = { topic?: string; text: string; quote: string; grounded: boolean }

export type Flashcard = { front: string; back: string; quote: string; grounded: boolean }

export type QuizOption = { text: string; explanation: string }

export type Question = {
  stem: string
  options: QuizOption[]
  answer: 'A' | 'B' | 'C' | 'D' | 'E'
  quote: string
  grounded: boolean
}

export type StudyPack = {
  title: string
  overview: string[]
  summary: TeachingPoint[]
  flashcards: Flashcard[]
  questions: Question[]
  search_terms: string[]
  // Passages of the material no item draws on, out of passage_count in all.
  uncovered: string[]
  passage_count: number
  model: string
}

// Further reading: links found by real services for one search term. The AI never writes them.
export type ReadingLink = { title: string; url: string; detail: string }

export type ReadingSource = {
  key: string
  name: string
  // One line on what the source is, such as which YouTube channels WardWise searches.
  about: string
  // 'search' is a single link to the service's own search page, for services without a free API.
  kind: 'results' | 'search'
  status: 'ok' | 'failed' | 'off'
  links: ReadingLink[]
  note: string | null
}

export type Reading = { term: string; sources: ReadingSource[] }

// Ask about my session. Mirrors AnswerSource, AnswerPart and Answer in backend/app/schemas.py.
export type SourceKind = 'session' | 'pubmed' | 'statpearls'

export type AnswerSource = {
  number: number
  kind: SourceKind
  title: string
  // Built by WardWise's server from a checked id, never by the AI. Null for the session.
  url: string | null
  detail: string
  // The passages the answer cites, so the student can read what it rests on.
  passages: string[]
}

export type AnswerPart = {
  text: string
  sources: number[]
  quote: string
  // The quote was found in the passages this part cites.
  grounded: boolean
  // The question names a group (such as children) and the cited passages do not say they are about it.
  group_unclear: boolean
}

export type Answer = {
  // The question as WardWise understood it, a follow-up rewritten to stand on its own.
  question: string
  parts: AnswerPart[]
  sources: AnswerSource[]
  disagree: boolean
  group: string
  // When the question names no group: the patients the session is about, which the answer was written for.
  // Missing from answers saved before 2026-11-11.
  population?: string
  // About a real patient's care: nothing was searched or answered.
  declined: boolean
  searched: string[]
  notes: string[]
  model: string
}

// One question and its answer, as kept with the pack.
export type ChatTurn = { id: string; question: string; askedAt: string; answer: Answer }

export type JobState = {
  status: 'queued' | 'working' | 'done' | 'failed'
  step: string
  materials: Materials | null
  pack: StudyPack | null
  // A quiz written on its own, for a pack that came without one.
  questions: Question[] | null
  answer: Answer | null
  error: string | null
}

export type WriteState =
  | { status: 'idle' }
  | { status: 'writing'; step: string }
  // The pack itself is shown and saved by App; this only says the write finished.
  | { status: 'done' }
  | { status: 'error'; message: string }

export type SendState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'working'; step: string; receipt: SessionReceipt }
  // `materials` is what WardWise produced, kept unchanged; the student's corrections live in App.
  // `recording` and `photos` are the inputs WardWise read, to notice if they change afterwards.
  | { status: 'ready'; materials: Materials; recording: Recording | null; photos: NotePhoto[] }
  | { status: 'error'; message: string }
