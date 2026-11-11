import { groupByTopic } from '@/lib/topics'
import type { StudyPack } from '@/types'

// One thing read aloud, in sentences. The key matches what is on screen, so it can be highlighted.
export type Spoken = { key: string; sentences: string[] }

// The screen's own words, so the warning is the same heard or read.
export const UNCHECKED = 'WardWise could not find this in your material. Check it before you rely on it.'

type Script = Pick<StudyPack, 'title' | 'overview' | 'summary' | 'uncovered' | 'passage_count'>

// The summary as it is read, with every warning the screen shows: written by AI (and from where), the
// overview not checked, an unchecked point flagged before its words, and the parts of the session the pack
// does not quote.
export function readingScript(pack: Script, imported = false): Spoken[] {
  const items: Spoken[] = [
    {
      key: 'intro',
      sentences: [
        `${forSpeech(pack.title)}.`,
        imported
          ? 'An imported summary written by AI. WardWise cannot confirm where its material came from.'
          : 'A summary written by AI from your session. Check it against trusted sources.',
      ],
    },
  ]
  pack.overview.forEach((paragraph, index) => {
    const lead = index === 0 ? ['Overview, written by AI. WardWise cannot check this part against your material.'] : []
    items.push({ key: `overview-${index}`, sentences: [...lead, ...sentencesOf(paragraph)] })
  })
  groupByTopic(pack.summary).forEach((group, groupIndex) => {
    group.points.forEach(({ point, number }, index) => {
      items.push({
        key: `point-${number}`,
        sentences: [
          ...(groupIndex === 0 && index === 0 ? ['Key teaching points.'] : []),
          ...(group.topic && index === 0 ? [`${forSpeech(group.topic)}.`] : []),
          // Heard before the point, so skipping ahead or drifting off cannot lose it.
          ...(point.grounded ? [] : [`Unchecked point. ${UNCHECKED}`]),
          ...sentencesOf(point.text),
        ],
      })
    })
  })
  const missed = pack.uncovered.length
  if (pack.passage_count > 0 && missed > 0) {
    items.push({
      key: 'coverage',
      sentences: [
        `${missed} of ${pack.passage_count} parts of your session ${missed === 1 ? 'is' : 'are'} not quoted in this pack. Read ${missed === 1 ? 'it' : 'them'} on screen, in case they hold teaching the pack missed.`,
      ],
    })
  }
  items.push({ key: 'end', sentences: ['End of summary.'] })
  return items
}

// Above this, a sentence is read in pieces: some online voices stop partway through a long utterance.
const LONG_SENTENCE_WORDS = 30

// Sentence by sentence, so pausing resumes at a sentence, and long ones in pieces at a semicolon or comma.
function sentencesOf(text: string) {
  return forSpeech(text)
    .split(/(?<=[.!?])\s+(?=[\p{Lu}\d"“(])/u)
    .flatMap(inPieces)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function inPieces(sentence: string) {
  if (sentence.split(/\s+/).length <= LONG_SENTENCE_WORDS) return [sentence]
  const pieces: string[] = []
  for (const part of sentence.split(/(?<=[;,])\s+/)) {
    const last = pieces.at(-1)
    if (last && `${last} ${part}`.split(/\s+/).length <= LONG_SENTENCE_WORDS / 1.5) pieces[pieces.length - 1] = `${last} ${part}`
    else pieces.push(part)
  }
  return pieces
}

// Units said in full after a number, singular and plural. Spelled as written, so "Mg 0.7" (magnesium) or
// "3 G" are not read as grams.
const UNITS: Record<string, [string, string]> = {
  mg: ['milligram', 'milligrams'],
  mcg: ['microgram', 'micrograms'],
  µg: ['microgram', 'micrograms'],
  μg: ['microgram', 'micrograms'],
  ug: ['microgram', 'micrograms'],
  g: ['gram', 'grams'],
  kg: ['kilogram', 'kilograms'],
  ml: ['millilitre', 'millilitres'],
  mL: ['millilitre', 'millilitres'],
  l: ['litre', 'litres'],
  L: ['litre', 'litres'],
  mmol: ['millimole', 'millimoles'],
  IU: ['international unit', 'international units'],
  mmHg: ['millimetre of mercury', 'millimetres of mercury'],
  bpm: ['beat per minute', 'beats per minute'],
  h: ['hour', 'hours'],
  hr: ['hour', 'hours'],
  hrs: ['hour', 'hours'],
  min: ['minute', 'minutes'],
  mins: ['minute', 'minutes'],
  '°C': ['degree Celsius', 'degrees Celsius'],
}
const PER: Record<string, string> = {
  kg: 'kilogram',
  min: 'minute',
  h: 'hour',
  hr: 'hour',
  day: 'day',
  l: 'litre',
  L: 'litre',
  dose: 'dose',
  m2: 'square metre',
}
// Longest first, so "mmol" is not read as "m" and "mol".
const alternatives = (words: string[]) => [...words].sort((a, b) => b.length - a.length).join('|')
const NOT_IN_A_WORD = String.raw`(?<![\p{L}\d.])`
// One or more "per" parts: "mcg/kg/min" is micrograms per kilogram per minute.
const PER_CHAIN = String.raw`((?:\s*\/\s*(?:${alternatives(Object.keys(PER))})(?![\p{L}\d]))*)`
const AMOUNT_UNIT = new RegExp(
  String.raw`${NOT_IN_A_WORD}(\d+(?:\.\d+)?)\s*(${alternatives(Object.keys(UNITS))})(?![\p{L}\d])${PER_CHAIN}`,
  'gu',
)
const ONLY_PER = new RegExp(String.raw`(?<=\d)${PER_CHAIN.replace(/\*\)$/, '+)')}`, 'gu')

const perWords = (chain: string) =>
  chain
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ` per ${PER[part]}`)
    .join('')

// Signs a voice may drop, which would lose the direction of a threshold ("SpO2 <92%").
const SIGNS: Record<string, string> = {
  '≥': 'at least',
  '≤': 'at most',
  '<': 'less than',
  '>': 'more than',
  '↑': 'raised',
  '↓': 'lowered',
  '→': 'then',
}
const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

// Ward shorthand a voice gets wrong ("IV" read as "four"). Capitals only, so ordinary words are left alone,
// and not after a word that numbers things, where IV is the Roman numeral ("class IV", "stage IV").
const SHORTHAND: Record<string, string> = {
  IV: 'I V',
  IM: 'I M',
  SC: 'S C',
  BD: 'twice daily',
  TDS: 'three times daily',
  QDS: 'four times daily',
  PRN: 'as needed',
}
const NUMBERING = ['stage', 'grade', 'class', 'type', 'phase', 'nerve', 'factor', 'level', 'degree', 'part', 'lead', 'NYHA']
  .map((word) => `[${word[0].toUpperCase()}${word[0].toLowerCase()}]${word.slice(1)}`)
  .join('|')
const SHORTHAND_WORDS = new RegExp(
  String.raw`(?<!\b(?:${NUMBERING})\s+)\b(${Object.keys(SHORTHAND).join('|')})\b`,
  'g',
)

// Text as it should be spoken. Doses come first: ".5 mg" heard as "five milligrams" is a tenfold error,
// and "1-2 g" can be heard as "one minus two".
export function forSpeech(text: string) {
  return text
    .replace(new RegExp(String.raw`${NOT_IN_A_WORD}\.(\d)`, 'gu'), '0.$1')
    .replace(new RegExp(`[${Object.keys(SIGNS).join('')}]`, 'gu'), (sign) => ` ${SIGNS[sign]} `)
    .replace(/\b1:(\d{3,})\b/g, '1 in $1')
    .replace(/\b(\d{2,3})\/(\d{2,3})\b/g, '$1 over $2')
    .replace(new RegExp(String.raw`${NOT_IN_A_WORD}(\d+(?:\.\d+)?)\s*[-–]\s*(?=\d)`, 'gu'), '$1 to ')
    .replace(/(\d)\s*[x×]\s*(?=10\b)/g, '$1 times ')
    .replace(/(\d+)\s*\^\s*(\d+)/g, '$1 to the power of $2')
    .replace(new RegExp(`(\\d)([${SUPERSCRIPTS}]+)`, 'g'), (_, digit: string, power: string) =>
      `${digit} to the power of ${[...power].map((sign) => SUPERSCRIPTS.indexOf(sign)).join('')}`,
    )
    .replace(/\b(mmol|mg|mcg|g|IU)\s+L-1\b/g, '$1/L')
    .replace(AMOUNT_UNIT, (_, amount: string, unit: string, chain: string) => {
      const [one, many] = UNITS[unit]
      return `${amount} ${amount === '1' ? one : many}${perWords(chain)}`
    })
    .replace(ONLY_PER, (chain: string) => perWords(chain))
    .replace(SHORTHAND_WORDS, (word) => SHORTHAND[word])
    .replace(/ {2,}/g, ' ')
    .replace(/\( /g, '(')
}

// The parts of a voice WardWise looks at, so tests can pass plain objects.
export type VoiceLike = Pick<SpeechSynthesisVoice, 'voiceURI' | 'name' | 'lang' | 'localService'>

const ENGLISH = /^en([-_]|$)/i

// English voices, those on the device first. An online voice sends the text to its provider to be spoken.
export function englishVoices<V extends VoiceLike>(voices: V[]): V[] {
  return voices
    .filter((voice) => ENGLISH.test(voice.lang))
    .sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name))
}

// The voice chosen before if it is still there; else one on the device, in the reader's own English if
// possible; an online voice only when the device has none. Null leaves the choice to the browser.
export function pickVoice<V extends VoiceLike>(voices: V[], saved: string | null, language: string): V | null {
  const english = englishVoices(voices)
  const sameLanguage = (voice: V) => voice.lang.replace('_', '-').toLowerCase() === language.toLowerCase()
  return (
    english.find((voice) => voice.voiceURI === saved) ??
    english.find((voice) => voice.localService && sameLanguage(voice)) ??
    english.find((voice) => voice.localService) ??
    english[0] ??
    null
  )
}
