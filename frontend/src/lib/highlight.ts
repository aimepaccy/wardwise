import { DRUG_NAMES, NO_SUGGESTION, NOT_MISHEARINGS } from '@/lib/drugs'

// Marks the words where a mistake in a transcript or in notes read from a photo hurts most: numbers and
// doses, drug names, and words that look like a drug name misheard ("ipertropium"). Like a screening
// test, it is tuned to miss little: a false alarm costs a glance, a missed dose error costs much more.

export type MarkKind = 'number' | 'drug' | 'check'
export type Mark = { start: number; end: number; kind: MarkKind; suggestion?: string }

const DRUGS = new Set(DRUG_NAMES)
const NOT_MISHEARD = new Set(NOT_MISHEARINGS)
// The drugs a near-miss may be suggested as, grouped by first letter, since a mishearing keeps the first sound.
const BY_FIRST_LETTER = new Map<string, string[]>()
for (const drug of DRUG_NAMES) {
  if (NO_SUGGESTION.includes(drug)) continue
  BY_FIRST_LETTER.set(drug[0], [...(BY_FIRST_LETTER.get(drug[0]) ?? []), drug])
}

// Not inside a word ("SpO2", "B12"); a leading point is kept, since ".5 mg" read as "5 mg" is the error that matters.
const NUMBER = String.raw`(?<![\p{L}\d.])\.?\d+(?:[.,]\d+)?`
const WORD_NUMBER =
  'half|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred'
const UNIT = [
  '%', 'percent', 'mg', 'milligrams?', 'mcg', 'µg', 'μg', 'ug', 'micrograms?', 'g', 'grams?', 'kg', 'kilograms?',
  'ml', 'millilitres?', 'milliliters?', 'l', 'litres?', 'liters?', 'mmol', 'millimoles?', 'units?', 'iu',
  'mmhg', 'bpm', 'puffs?', 'drops?', 'tablets?', 'tabs?', 'doses?', 'hours?', 'hrs?', 'h', 'minutes?',
  'mins?', 'days?', 'weeks?', 'months?', 'times', 'degrees?', '°c',
].join('|')
const PER = String.raw`(?:\s*(?:\/|per)\s*(?:kilograms?|kg|minutes?|mins?|hours?|hrs?|h|days?|doses?|m2|litres?|liters?|l)(?![\p{L}]))?`
const RANGE = (n: string) => String.raw`${n}(?:\s*(?:-|–|to)\s*${n})?`

// A figure, perhaps a range, with any unit after it ("1-2 mg per kilogram", "94 to 98%", "40%").
// A number word counts only with a unit ("five puffs"), since "one" alone is everywhere.
const NUMBERS = new RegExp(
  String.raw`(?:${RANGE(NUMBER)}(?:\s*(?:${UNIT})(?![\p{L}]))?${PER})|(?:\b${RANGE(`(?:${WORD_NUMBER})`)}\s+(?:${UNIT})(?![\p{L}])${PER})`,
  'giu',
)
const WORDS = /\p{L}[\p{L}'’-]*/gu

export function findMarks(text: string): Mark[] {
  const marks: Mark[] = []
  for (const match of text.matchAll(NUMBERS)) {
    marks.push({ start: match.index, end: match.index + match[0].length, kind: 'number' })
  }
  for (const match of text.matchAll(WORDS)) {
    // "co-amoxiclav" is one name; "artemether-lumefantrine" is two.
    const whole = match[0].toLowerCase()
    const parts = DRUGS.has(whole) ? [{ word: whole, offset: 0 }] : splitHyphens(match[0])
    for (const { word, offset } of parts) {
      const start = match.index + offset
      const mark = classify(word.toLowerCase())
      if (mark) marks.push({ start, end: start + word.length, ...mark })
    }
  }
  return withoutOverlaps(marks)
}

function splitHyphens(word: string) {
  const parts: { word: string; offset: number }[] = []
  let offset = 0
  for (const part of word.split('-')) {
    if (part) parts.push({ word: part, offset })
    offset += part.length + 1
  }
  return parts
}

function classify(word: string): Omit<Mark, 'start' | 'end'> | null {
  // "Ringer's" and "insulins" are still the drug.
  const base = word.replace(/['’]s$/, '')
  if (DRUGS.has(base) || (base.endsWith('s') && DRUGS.has(base.slice(0, -1)))) return { kind: 'drug' }
  if (NOT_MISHEARD.has(base)) return null
  if (!suggestions.has(base)) suggestions.set(base, nearestDrug(base))
  const suggestion = suggestions.get(base)
  return suggestion ? { kind: 'check', suggestion } : null
}

// Transcripts repeat their words, so each word is looked up against the list once.
const suggestions = new Map<string, string | null>()

// A word close to a drug name but not one is probably the drug, misheard or misread. Short words are left
// alone (too many ordinary words sit one letter from a short name), the first letter must match (a
// mishearing usually keeps the first sound), and longer words may be two letters away.
export function nearestDrug(word: string): string | null {
  if (word.length < 6) return null
  const allowed = word.length >= 8 ? 2 : 1
  let best: string | null = null
  let bestDistance = allowed + 1
  for (const drug of BY_FIRST_LETTER.get(word[0]) ?? []) {
    if (Math.abs(drug.length - word.length) > allowed) continue
    const distance = editDistance(word, drug, allowed)
    if (distance > 0 && distance < bestDistance) {
      best = drug
      bestDistance = distance
    }
  }
  return best
}

// Levenshtein distance: the fewest single-letter insertions, deletions or swaps from one word to the other.
// Gives up early once every path is already over `limit`.
export function editDistance(a: string, b: string, limit = Infinity): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const swap = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, swap)
    }
    if (Math.min(...current) > limit) return limit + 1
    previous = current
  }
  return previous[b.length]
}

// Earliest first; where two marks overlap, the first one found wins.
function withoutOverlaps(marks: Mark[]): Mark[] {
  const sorted = [...marks].sort((x, y) => x.start - y.start || y.end - x.end)
  const kept: Mark[] = []
  for (const mark of sorted) {
    if (mark.start >= (kept.at(-1)?.end ?? 0)) kept.push(mark)
  }
  return kept
}

export function countMarks(marks: Mark[]) {
  return {
    numbers: marks.filter((mark) => mark.kind === 'number').length,
    drugs: marks.filter((mark) => mark.kind === 'drug').length,
    checks: marks.filter((mark) => mark.kind === 'check').length,
  }
}
