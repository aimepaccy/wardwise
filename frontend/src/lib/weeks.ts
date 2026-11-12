import type { SavedPack } from '@/lib/storage'
import type { SavedWeek } from '@/lib/storage'
import type { HighlightsRequest, Question } from '@/types'

// A study week is Monday to Friday, in the student's own time zone. A pack saved on a Saturday or Sunday
// (a rare weekend round) joins the week that has just ended, so in practice a week runs from Monday 00:00
// to the next Monday. Its highlights are written once the week's rounds are over: Friday at 18:00.
// Dates are cut in local time on purpose: savedAt is stored in UTC, and 23:00 UTC on a Sunday is
// already Monday in Kigali.

const UNLOCK_DAY = 4
const UNLOCK_HOUR = 18
export const WEEK_QUIZ_QUESTIONS = 10

export type Week = {
  // The Monday the week starts on, as YYYY-MM-DD in local time.
  key: string
  start: Date
  // Oldest first, the order the sessions happened.
  packs: SavedPack[]
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

// Midnight on the Monday of the date's week. getDay counts from Sunday (0), so Sunday is 6 days after Monday.
export function weekStart(date: Date) {
  return addDays(date, -((date.getDay() + 6) % 7))
}

// The key of the date's week: its Monday as YYYY-MM-DD, in local time. Keys sort in date order.
export function weekKey(date: Date) {
  const start = weekStart(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
}

export function unlocksAt(week: Week) {
  const friday = addDays(week.start, UNLOCK_DAY)
  return new Date(friday.getFullYear(), friday.getMonth(), friday.getDate(), UNLOCK_HOUR)
}

// Demo branch only: with VITE_DEMO_WEEK_OVER=1 the current week counts as over, so its highlights can be
// shown before Friday 18:00. Never merged into main.
export function isOver(week: Week, now: Date) {
  if (import.meta.env.VITE_DEMO_WEEK_OVER === '1' && week.start <= now) return true
  return now >= unlocksAt(week)
}

// The weeks that have packs, newest first. The current week is always there, even empty, so the
// student lands on it. A pack dated in the future (another device's clock, an edited import) gets a
// week of its own after the current one.
export function groupByWeek(records: SavedPack[], now: Date): Week[] {
  const weeks = new Map<string, Week>()
  const weekFor = (date: Date) => {
    const key = weekKey(date)
    let week = weeks.get(key)
    if (!week) {
      week = { key, start: weekStart(date), packs: [] }
      weeks.set(key, week)
    }
    return week
  }
  weekFor(now)
  for (const record of records) weekFor(new Date(record.savedAt)).packs.push(record)
  // ISO dates and keys sort as plain strings.
  const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  for (const week of weeks.values()) week.packs.sort((a, b) => order(a.savedAt, b.savedAt))
  return [...weeks.values()].sort((a, b) => order(b.key, a.key))
}

// The pack's topics in the order taught, each once whatever its capitals. Packs written before topics
// existed have none.
export function topicsOf(record: SavedPack) {
  const topics = new Map<string, string>()
  for (const point of record.pack.summary) {
    const topic = point.topic?.trim()
    if (topic && !topics.has(topic.toLowerCase())) topics.set(topic.toLowerCase(), topic)
  }
  return [...topics.values()]
}

export type WeekQuestion = { question: Question; from: SavedPack }

// The week's quiz: checked questions only, taken in turn from each session (the first of each, then the
// second, and so on), so every session gets a fair share and topics are mixed rather than in blocks.
export function weekQuiz(week: Week, max = WEEK_QUIZ_QUESTIONS): WeekQuestion[] {
  const queues = week.packs.map((from) => from.pack.questions.filter((q) => q.grounded).map((question) => ({ question, from })))
  const picked: WeekQuestion[] = []
  for (let round = 0; picked.length < max && queues.some((queue) => round < queue.length); round++) {
    for (const queue of queues) {
      if (round < queue.length && picked.length < max) picked.push(queue[round])
    }
  }
  return picked
}

const rangeFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const yearFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

// "This week", "Last week", or the date the week starts, with its year if it is not this year's.
export function weekName(week: Week, now: Date) {
  if (week.key === weekKey(now)) return 'This week'
  if (week.key === weekKey(addDays(weekStart(now), -7))) return 'Last week'
  const format = week.start.getFullYear() === now.getFullYear() ? rangeFormat : yearFormat
  return `Week of ${format.format(week.start)}`
}

// Monday to Friday. A weekend session is listed with its week all the same.
export function weekRange(week: Week) {
  return `${rangeFormat.format(week.start)} to ${rangeFormat.format(addDays(week.start, UNLOCK_DAY))}`
}

// Which writings of which packs a week was made from. Writing a pack again gives it a new savedAt, so a
// changed, added or deleted pack changes the fingerprint, and highlights from before are out of date.
export function fingerprint(packs: { id: string; savedAt: string }[]) {
  return packs.map((record) => `${record.id}@${record.savedAt}`).join(',')
}

// The server's limits (HighlightsRequest in backend/app/schemas.py).
const MAX_SESSIONS = 20
const MAX_POINTS = 300
const MAX_POINT_CHARS = 1000
const MAX_TOPIC_CHARS = 200
// English day names for the writer, whatever language the browser shows.
const dayForWriter = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })

// What the highlights are written from: each session's day and title, and its teaching points whose quote was
// found in the session. Not the quotes or the sessions themselves: the points already hold the teaching.
export function highlightsRequest(week: Week): HighlightsRequest {
  const packs = week.packs.slice(0, MAX_SESSIONS)
  const points = packs.flatMap((record, index) =>
    record.pack.summary
      .filter((point) => point.grounded && point.text.trim())
      .map((point) => ({
        session: index + 1,
        topic: (point.topic?.trim() ?? '').slice(0, MAX_TOPIC_CHARS),
        text: point.text.trim().slice(0, MAX_POINT_CHARS),
      })),
  )
  return {
    sessions: packs.map((record) => ({ day: dayForWriter.format(new Date(record.savedAt)), title: record.pack.title.slice(0, 200) })),
    points: points.slice(0, MAX_POINTS),
  }
}

// The packs a week's highlights are written from (all of them, unless a week has more than the server takes).
// Saved highlights are compared with this, never with all the week's packs, or a week of more than 20 packs
// would never match and be written again and again.
export function highlightsBasis(week: Week) {
  return fingerprint(week.packs.slice(0, MAX_SESSIONS))
}

export type HighlightsPlan =
  | 'locked' // the week is not over
  | 'empty' // no checked teaching points to write from
  | 'loading' // not yet known what this browser holds
  | 'current' // saved highlights match the week's packs
  | 'failed' // the last try failed in this opening of the sheet
  | 'tried' // already written once for these packs in this opening: never again, whatever the comparison says
  | 'write'

// Whether to write the week's highlights now. A pure function, so the rules that spend the AI allowance are
// tested on their own (lib/weeks.test.ts); the hook only carries out the answer.
export function planHighlights(input: {
  week: Week
  now: Date
  hasPoints: boolean
  // undefined: not read yet in this opening; null: none saved.
  saved: SavedWeek | null | undefined
  failed: boolean
  // The basis already written for in this opening of the sheet, if any.
  tried: string | undefined
}): HighlightsPlan {
  const { week, now, hasPoints, saved, failed, tried } = input
  const basis = highlightsBasis(week)
  if (!isOver(week, now)) return 'locked'
  if (saved && fingerprint(saved.sources) === basis) return 'current'
  if (!hasPoints) return 'empty'
  if (saved === undefined) return 'loading'
  if (failed) return 'failed'
  if (tried === basis) return 'tried'
  return 'write'
}
