import type { Answer, ChatTurn } from '@/types'

// The server reads only the last three turns, and takes answers of up to 4,000 characters.
const HISTORY_TURNS = 3
const MAX_HISTORY_ANSWER_CHARS = 4000

export const NOT_ANSWERED = 'WardWise could not find an answer to this in your session or in the literature it searched.'

// Well under the 500 an import accepts, so a pack's own export always imports again.
const MAX_KEPT_TURNS = 200

// Declined turns are never kept or sent back: the question may name a real patient, and there is no teaching
// in them to follow up on. Past the limit, the oldest turns go.
export function keptTurns(turns: ChatTurn[]) {
  return turns.filter((turn) => !turn.answer.declined).slice(-MAX_KEPT_TURNS)
}

// The plain signs of a real patient, as on the server (backend/app/ask/__init__.py). Caught here, such a question
// never leaves the device; the server's own check, with the AI's judgement, still catches subtler ones.
const NUMBER = String.raw`(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b`
const PERSON = '(patients?|lady|ladies|man|men|woman|women|gentleman|boy|girl|child|baby|infant|kid|mum|mother|father)'
const SAW = String.raw`(clerked|admitted|saw|seen|reviewed|examined|assessed|am\s+looking\s+after|'m\s+looking\s+after|am\s+seeing|'m\s+seeing)`
const REAL_PATIENT = new RegExp(
  String.raw`\b(my\s+patients?` +
    String.raw`|(bed|bay|cubicle|room|side\s*room)\s*(no\.?\s*)?${NUMBER}` +
    String.raw`|(mr|mrs|ms|miss)\.?\s+[a-z]` +
    String.raw`|${PERSON}\s+(that\s+|who\s+)?(i|we)\s*(have\s+|just\s+)*${SAW}` +
    String.raw`|(i|we)\s*(have\s+|just\s+)*${SAW}\s+(a|an|the|this|that)\s+(\w+\s+)?${PERSON}` +
    String.raw`|${PERSON}\s+on\s+(my|our|the)\s+ward` +
    String.raw`|on\s+(my|our)\s+ward\s+(right\s+)?now)`,
  'i',
)
// Initials such as "J.N.", in capitals only, so "e.g." and "i.e." do not count.
const INITIALS = /\b[A-Z]\.\s?[A-Z]\./

export function mentionsRealPatient(question: string) {
  return REAL_PATIENT.test(question) || INITIALS.test(question)
}

export function declinedAnswer(question: string): Answer {
  return { question, parts: [], sources: [], disagree: false, group: '', declined: true, searched: [], notes: [], model: '' }
}

// The server is stateless: it remembers no conversation, so each question carries the turns before it.
export function historyFor(turns: ChatTurn[]) {
  return keptTurns(turns)
    .slice(-HISTORY_TURNS)
    .map((turn) => ({ question: turn.question, answer: answerText(turn.answer).slice(0, MAX_HISTORY_ANSWER_CHARS) }))
}

export function answerText(answer: Answer) {
  return answer.parts.length > 0 ? answer.parts.map((part) => part.text).join(' ') : NOT_ANSWERED
}

// Links only to the two places WardWise's server builds them for, so a forged import cannot add others.
const SOURCE_LINK = /^https:\/\/(pubmed\.ncbi\.nlm\.nih\.gov\/\d{1,9}\/|www\.ncbi\.nlm\.nih\.gov\/books\/NBK\d{1,9}\/)$/

export function sourceLink(url: string | null) {
  return url !== null && SOURCE_LINK.test(url) ? url : null
}

// Where the quote sits in a passage, to highlight it, or null. Ignores case, spacing and punctuation between
// words; for a quote with a gap ("..."), finds its longest piece.
export function findQuote(passage: string, quote: string): { start: number; end: number } | null {
  const pieces = quote.split(/\.\.\.|…/).map((piece) => piece.match(/[\p{L}\p{N}]+/gu) ?? [])
  const longest = pieces.reduce((best, piece) => (piece.length > best.length ? piece : best), [] as string[])
  if (longest.length < 2) return null
  // The words hold only letters and digits, so they are safe to put in a pattern as they are.
  const match = new RegExp(longest.join('[^\\p{L}\\p{N}]+'), 'iu').exec(passage)
  return match ? { start: match.index, end: match.index + match[0].length } : null
}
