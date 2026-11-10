import { describe, expect, it } from 'vitest'
import { countMarks, editDistance, findMarks, nearestDrug } from '@/lib/highlight'

function marked(text: string) {
  return findMarks(text).map((mark) => [text.slice(mark.start, mark.end), mark.kind, mark.suggestion].filter(Boolean))
}

// What Whisper wrote for a synthetic role-play on 2026-11-10 (it misheard "ipratropium" and "nebulised").
const HEARD =
  'Give salbutamol 5 mg nebulast, back to back. Add ipertropium 250 micrograms. ' +
  'Prednisolone 1-2 mg per kilogram, maximum 40 mg. Keep saturations 94 to 98%.'

describe('finding the words to check', () => {
  it('marks doses, drugs and a misheard drug in a real transcript', () => {
    expect(marked(HEARD)).toEqual([
      ['salbutamol', 'drug'],
      ['5 mg', 'number'],
      ['ipertropium', 'check', 'ipratropium'],
      ['250 micrograms', 'number'],
      ['Prednisolone', 'drug'],
      ['1-2 mg per kilogram', 'number'],
      ['40 mg', 'number'],
      ['94 to 98%', 'number'],
    ])
  })

  it('counts each kind', () => {
    expect(countMarks(findMarks(HEARD))).toEqual({ numbers: 5, drugs: 2, checks: 1 })
  })

  it('keeps decimals and rates together', () => {
    expect(marked('Magnesium 1.2-2 g over 20 minutes, then 0.5 mg/kg')).toEqual([
      ['Magnesium', 'drug'],
      ['1.2-2 g', 'number'],
      ['20 minutes', 'number'],
      ['0.5 mg/kg', 'number'],
    ])
  })

  it('keeps whole rate units, and a leading decimal point', () => {
    expect(marked('Oxygen 2 litres per minute, fluids 5 ml/hr, then .5 mg')).toEqual([
      ['Oxygen', 'drug'],
      ['2 litres per minute', 'number'],
      ['5 ml/hr', 'number'],
      ['.5 mg', 'number'],
    ])
  })

  it('leaves digits inside words alone', () => {
    expect(marked('SpO2 and B12')).toEqual([])
  })

  it('counts number words only with a unit', () => {
    expect(marked('This one needs two puffs.')).toEqual([['two puffs', 'number']])
  })

  it('treats a hyphenated name as one drug, and a combination as two', () => {
    expect(marked('co-amoxiclav or artemether-lumefantrine')).toEqual([
      ['co-amoxiclav', 'drug'],
      ['artemether', 'drug'],
      ['lumefantrine', 'drug'],
    ])
  })

  it('leaves ordinary words alone', () => {
    expect(marked('Hearing the history from the mother is the first step.')).toEqual([])
  })

  // Pairs found in a pharmacist-style review of the list (2026-11-10).
  it('does not flag clinical words that sit close to a drug name', () => {
    expect(marked('Follow the protocol: a thiazide, oxytocics, then a vasopressor.')).toEqual([])
  })

  it('recognises possessives and plurals', () => {
    expect(marked("Ringer's lactate, Hartmann’s, two insulins")).toEqual([
      ["Ringer's", 'drug'],
      ['Hartmann’s', 'drug'],
      ['insulins', 'drug'],
    ])
  })

  it('recognises older British spellings', () => {
    expect(marked('amoxycillin and sulphamethoxazole')).toEqual([
      ['amoxycillin', 'drug'],
      ['sulphamethoxazole', 'drug'],
    ])
  })
})

describe('near misses', () => {
  it('suggests the drug a misheard word is closest to', () => {
    expect(nearestDrug('ipertropium')).toBe('ipratropium')
    expect(nearestDrug('ceftriaxon')).toBe('ceftriaxone')
    expect(nearestDrug('frusemid')).toBe('frusemide')
  })

  it('does not stretch short words or change the first letter', () => {
    expect(nearestDrug('hearing')).toBeNull() // two letters from heparin
    expect(nearestDrug('salbutamol')).toBeNull() // already a drug
    expect(nearestDrug('zalbutamol')).toBeNull()
    expect(nearestDrug('senne')).toBeNull()
  })

  it('measures edit distance', () => {
    expect(editDistance('ipertropium', 'ipratropium')).toBe(2)
    expect(editDistance('kitten', 'sitting')).toBe(3)
    expect(editDistance('same', 'same')).toBe(0)
  })
})
