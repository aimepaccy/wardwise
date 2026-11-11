import { describe, expect, it } from 'vitest'
import { NOT_ANSWERED, answeredFor, findQuote, historyFor, keptTurns, mentionsRealPatient, sourceLink } from '@/lib/chat'
import { answerOf } from '@/test/answers'
import type { Answer, ChatTurn } from '@/types'

const turn = (question: string, answer: Answer): ChatTurn => ({ id: question, question, askedAt: '2026-11-11T09:00:00.000Z', answer })

describe('the history sent with a question', () => {
  it('sends the last three turns, as plain text', () => {
    const turns = ['one', 'two', 'three', 'four'].map((question) => turn(question, answerOf()))
    const history = historyFor(turns)
    expect(history.map((entry) => entry.question)).toEqual(['two', 'three', 'four'])
    expect(history[0].answer).toBe('In your session, nebulised salbutamol.')
  })

  it('leaves declined turns out, since they may name a real patient', () => {
    const turns = [turn('fine', answerOf()), turn('Mr K in bed 4?', answerOf({ declined: true, parts: [], sources: [] }))]
    expect(historyFor(turns).map((entry) => entry.question)).toEqual(['fine'])
    expect(keptTurns(turns)).toHaveLength(1)
  })

  it('says plainly when a turn was not answered', () => {
    expect(historyFor([turn('odd', answerOf({ parts: [], sources: [] }))])[0].answer).toBe(NOT_ANSWERED)
  })
})

describe('questions about a real patient', () => {
  it('are caught in the browser by their plain signs', () => {
    for (const question of [
      'My patient is wheezy, what now?',
      'What dose for bed 4?',
      'Is Mrs Uwase on prednisolone?',
      'Mr. k in room 12',
      'The lady I clerked this morning still has a peak flow of 40%.',
      'Mukamana in side room two is still wheezy.',
      'J.N. on our ward right now has a silent chest.',
      "The patient I'm looking after is drowsy.",
    ]) {
      expect(mentionsRealPatient(question)).toBe(true)
    }
  })

  it('leave teaching questions alone', () => {
    for (const question of [
      'What dose did the patient in the case get?',
      'How many mg of magnesium?',
      'Why bedside peak flow?',
      'On our ward we usually give 40 mg. Does the literature agree?',
      'I reviewed the guideline: is 5 mg right?',
      'Why check peak flow, e.g. before a neb?',
    ]) {
      expect(mentionsRealPatient(question)).toBe(false)
    }
  })
})

describe('who an answer was written for', () => {
  it('names a group the student asked about, without calling it assumed', () => {
    expect(answeredFor(answerOf({ group: 'children' }))).toEqual({ group: 'children', assumed: false })
  })

  it("says when the session's patients were assumed, in words a reader would use", () => {
    expect(answeredFor(answerOf({ population: 'adults' }))).toEqual({ group: 'adults', assumed: true })
    expect(answeredFor(answerOf({ population: 'pregnancy' }))).toEqual({ group: 'pregnant women', assumed: true })
  })

  it('shows nothing for an answer saved before populations existed', () => {
    expect(answeredFor(answerOf())).toEqual({ group: '', assumed: false })
  })
})

describe('kept turns', () => {
  it('keep the newest 200, so an export always imports again', () => {
    const turns = Array.from({ length: 205 }, (_, index) => turn(`q${index}`, answerOf()))
    const kept = keptTurns(turns)
    expect(kept).toHaveLength(200)
    expect(kept[0].question).toBe('q5')
  })
})

describe('source links', () => {
  it('keeps the two kinds of link the server builds', () => {
    expect(sourceLink('https://pubmed.ncbi.nlm.nih.gov/12345678/')).not.toBeNull()
    expect(sourceLink('https://www.ncbi.nlm.nih.gov/books/NBK430901/')).not.toBeNull()
  })

  it('drops any other link', () => {
    for (const url of [
      'javascript:alert(1)',
      'http://pubmed.ncbi.nlm.nih.gov/123/',
      'https://pubmed.ncbi.nlm.nih.gov.evil.example/123/',
      'https://evil.example/?https://pubmed.ncbi.nlm.nih.gov/123/',
      'https://www.ncbi.nlm.nih.gov/books/NBK1/../../evil',
      null,
    ]) {
      expect(sourceLink(url)).toBeNull()
    }
  })
})

describe('finding the quote in a passage', () => {
  it('ignores case and punctuation between words', () => {
    const passage = 'Then give Salbutamol, 5 mg, nebulised every 20 minutes.'
    const at = findQuote(passage, 'salbutamol 5 mg nebulised')!
    expect(passage.slice(at.start, at.end)).toBe('Salbutamol, 5 mg, nebulised')
  })

  it('finds the longest piece of a quote with a gap', () => {
    const passage = 'Oxygen first. Later, check the peak flow every hour.'
    const at = findQuote(passage, 'Oxygen ... check the peak flow every hour')!
    expect(passage.slice(at.start, at.end)).toBe('check the peak flow every hour')
  })

  it('returns nothing when the quote is not there', () => {
    expect(findQuote('Give oxygen.', 'give salbutamol now')).toBeNull()
  })

  it('treats symbols in the quote as plain text, not as a pattern', () => {
    expect(findQuote('a (b) c', '(b) c [d]')).toBeNull()
    expect(findQuote('rate (b) c', 'rate (b) c')).not.toBeNull()
  })
})
