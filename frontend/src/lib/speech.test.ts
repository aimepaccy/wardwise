import { describe, expect, it } from 'vitest'
import { englishVoices, forSpeech, highlightsScript, pickVoice, readingScript, type VoiceLike, UNCHECKED } from '@/lib/speech'
import type { StudyPack, TeachingPoint } from '@/types'

const point = (text: string, changes: Partial<TeachingPoint> = {}): TeachingPoint => ({ text, quote: 'q', grounded: true, ...changes })

const packOf = (changes: Partial<StudyPack>): StudyPack => ({
  title: 'Acute asthma',
  overview: [],
  summary: [],
  flashcards: [],
  questions: [],
  search_terms: [],
  uncovered: [],
  passage_count: 0,
  model: 'test',
  ...changes,
})

describe('doses read aloud', () => {
  it('never loses a leading zero, so ".5 mg" is not heard as five', () => {
    expect(forSpeech('Give .5 mg now.')).toBe('Give 0.5 milligrams now.')
  })

  it('reads a range as "to", not "minus"', () => {
    expect(forSpeech('1-2 g over 20 minutes')).toBe('1 to 2 grams over 20 minutes')
    expect(forSpeech('SpO2 94–98%')).toBe('SpO2 94 to 98%')
  })

  it('says units in full, with "per", and singular for one', () => {
    expect(forSpeech('40 mg/kg')).toBe('40 milligrams per kilogram')
    expect(forSpeech('1 mg')).toBe('1 milligram')
    expect(forSpeech('250 µg, 2.5mg, 5 mL/h, 3 mmol/L')).toBe(
      '250 micrograms, 2.5 milligrams, 5 millilitres per hour, 3 millimoles per litre',
    )
    expect(forSpeech('RR 40/min')).toBe('RR 40 per minute')
    expect(forSpeech('WCC 12 x 10^9/L')).toBe('WCC 12 times 10 to the power of 9 per litre')
  })

  it('leaves letters that are not units alone', () => {
    expect(forSpeech('4 hourly, 2 levels, a q4h order, grade 3 G')).toBe('4 hourly, 2 levels, a q4h order, grade 3 G')
    expect(forSpeech('Vitamin B12 and SpO2')).toBe('Vitamin B12 and SpO2')
  })

  it('keeps the direction of a threshold, which a voice may drop with the sign', () => {
    expect(forSpeech('SpO2 <92% or PEF ≥50%')).toBe('SpO2 less than 92% or PEF at least 50%')
    expect(forSpeech('K+ ↓ (<3.5 mmol/L)')).toBe('K+ lowered (less than 3.5 millimoles per litre)')
  })

  it('reads chained rates, powers, ratios and blood pressures', () => {
    expect(forSpeech('0.1 mcg/kg/min')).toBe('0.1 micrograms per kilogram per minute')
    expect(forSpeech('2.5-5 mg')).toBe('2.5 to 5 milligrams')
    expect(forSpeech('(.5 mg) and .5 g')).toBe('(0.5 milligrams) and 0.5 grams')
    expect(forSpeech('WCC 12 x 10⁹/L')).toBe('WCC 12 times 10 to the power of 9 per litre')
    expect(forSpeech('potassium 4 mmol L-1')).toBe('potassium 4 millimoles per litre')
    expect(forSpeech('adrenaline 1:1000, BP 120/80')).toBe('adrenaline 1 in 1000, BP 120 over 80')
  })

  it('reads units only as they are written, so magnesium is not milligrams', () => {
    expect(forSpeech('Ca 2.2 Mg 0.7, and 3 MG')).toBe('Ca 2.2 Mg 0.7, and 3 MG')
  })

  it('reads ward shorthand so a voice does not say "four" for IV', () => {
    expect(forSpeech('Hydrocortisone IV, then prednisolone BD, salbutamol PRN')).toBe(
      'Hydrocortisone I V, then prednisolone twice daily, salbutamol as needed',
    )
    expect(forSpeech('Iv bd prn')).toBe('Iv bd prn')
  })

  it('leaves IV alone where it is a Roman numeral', () => {
    expect(forSpeech('NYHA class IV, stage IV, Type IV, cranial nerve IV')).toBe('NYHA class IV, stage IV, Type IV, cranial nerve IV')
  })
})

describe('what is read from a summary', () => {
  it('starts by saying it was written by AI, then reads the overview, said to be unchecked, and the points', () => {
    const items = readingScript(packOf({ overview: ['First. Second one.'], summary: [point('Give oxygen.')] }))
    expect(items.map((item) => item.key)).toEqual(['intro', 'overview-0', 'point-1', 'end'])
    expect(items[0].sentences.join(' ')).toContain('written by AI')
    expect(items[1].sentences).toEqual([
      'Overview, written by AI. WardWise cannot check this part against your material.',
      'First.',
      'Second one.',
    ])
    expect(items[2].sentences).toEqual(['Key teaching points.', 'Give oxygen.'])
  })

  it('says an imported summary cannot be traced', () => {
    expect(readingScript(packOf({}), true)[0].sentences[1]).toContain('cannot confirm where its material came from')
  })

  it('warns about an unchecked point before reading it', () => {
    const items = readingScript(packOf({ summary: [point('Give 5 mg.', { grounded: false })] }))
    expect(items[1].sentences).toEqual(['Key teaching points.', `Unchecked point. ${UNCHECKED}`, 'Give 5 milligrams.'])
  })

  it('ends by saying how much of the session the pack does not quote', () => {
    const items = readingScript(packOf({ uncovered: ['a', 'b'], passage_count: 9 }))
    expect(items.at(-2)!.sentences[0]).toMatch(/^2 of 9 parts of your session are not quoted in this pack\. Read them on screen/)
    expect(readingScript(packOf({ uncovered: ['a'], passage_count: 9 })).at(-2)!.sentences[0]).toMatch(/^1 of 9 parts of your session is not quoted/)
    expect(readingScript(packOf({ passage_count: 9 })).map((item) => item.key)).toEqual(['intro', 'end'])
  })

  it('reads a very long sentence in pieces, at its commas', () => {
    const long = Array.from({ length: 8 }, (_, index) => `clause ${index} has five words`).join(', ') + '.'
    const sentences = readingScript(packOf({ summary: [point(long)] }))[1].sentences.slice(1)
    expect(sentences.length).toBeGreaterThan(1)
    expect(sentences.join(' ')).toBe(long)
  })

  it('names each topic once, before its first point', () => {
    const summary = [point('A.', { topic: 'Asthma' }), point('B.', { topic: 'Asthma' }), point('C.', { topic: 'Malaria' })]
    const items = readingScript(packOf({ summary }))
    expect(items.slice(1, -1).map((item) => item.sentences)).toEqual([
      ['Key teaching points.', 'Asthma.', 'A.'],
      ['B.'],
      ['Malaria.', 'C.'],
    ])
  })

  it('does not split a sentence at a decimal point', () => {
    const items = readingScript(packOf({ summary: [point('Give 2.5 mg. Then review.')] }))
    expect(items[1].sentences.slice(1)).toEqual(['Give 2.5 milligrams.', 'Then review.'])
  })
})

describe('choosing a voice', () => {
  const voice = (name: string, lang: string, localService: boolean): VoiceLike => ({ voiceURI: name, name, lang, localService })
  const voices = [
    voice('Google UK English', 'en-GB', false),
    voice('Amélie', 'fr-FR', true),
    voice('Zira', 'en-US', true),
    voice('Hazel', 'en_GB', true),
  ]

  it('lists English voices only, those on the device first', () => {
    expect(englishVoices(voices).map((each) => each.name)).toEqual(['Hazel', 'Zira', 'Google UK English'])
  })

  it("prefers a voice on the device, in the reader's own English", () => {
    expect(pickVoice(voices, null, 'en-GB')?.name).toBe('Hazel')
    expect(pickVoice(voices, null, 'rw-RW')?.name).toBe('Hazel')
  })

  it('keeps a voice chosen before, even an online one, and uses an online one only when there is no other', () => {
    expect(pickVoice(voices, 'Google UK English', 'en-GB')?.name).toBe('Google UK English')
    expect(pickVoice([voices[0]], null, 'en-GB')?.name).toBe('Google UK English')
    expect(pickVoice([voices[1]], null, 'en-GB')).toBeNull()
  })
})

describe('week highlights read aloud', () => {
  const written = {
    highlights: [{ heading: 'Oxygen targets', text: 'Aim for 94 to 98%. Give .5 mg if needed.', points: [1], sessions: [1] }],
    left_out: 3,
    model: 'test-model',
  }

  it('says who wrote them, reads each with its heading, and says what was left out', () => {
    const script = highlightsScript('Last week', written, 2)
    expect(script.map((item) => item.key)).toEqual(['intro', 'highlight-1', 'left-out', 'end'])
    expect(script[0].sentences.join(' ')).toContain('Written by AI')
    expect(script[0].sentences.join(' ')).toContain('2 sessions')
    expect(script[1].sentences[0]).toBe('Oxygen targets.')
    // Read safely, as the summary is: a missed leading zero is a tenfold error.
    expect(script[1].sentences.join(' ')).toContain('0.5 milligrams')
    expect(script[2].sentences[0]).toMatch(/^3 teaching points were left out/)
  })

  it('reads ranges and units written with look-alike hyphens and no-break spaces', () => {
    expect(forSpeech('Peak flow 33\u201150\u202f% of best; 5\u00a0mg and \u22125')).toBe('Peak flow 33 to 50 % of best; 5 milligrams and -5')
  })

  it('warns first when they are out of date', () => {
    expect(highlightsScript('Last week', written, 1, true)[0].sentences[1]).toBe("These are from before the week's sessions changed.")
  })

  it('has nothing about left-out points when none were', () => {
    expect(highlightsScript('This week', { ...written, left_out: 0 }, 1).map((item) => item.key)).toEqual(['intro', 'highlight-1', 'end'])
  })
})
