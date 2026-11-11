import type { SavedPack } from '@/lib/storage'
import type { Question } from '@/types'

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

export function isOver(week: Week, now: Date) {
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
