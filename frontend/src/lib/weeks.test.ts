import { describe, expect, it } from 'vitest'
import { newRecord, type SavedPack } from '@/lib/storage'
import { groupByWeek, isOver, topicsOf, weekName, weekQuiz, weekRange, weekStart, type Week } from '@/lib/weeks'
import type { Question, StudyPack } from '@/types'

// The tests run in Kigali time (set in vite.config.ts), so these local dates mean the same on any machine.

function question(stem: string, grounded = true): Question {
  return { stem, options: [{ text: 'Yes', explanation: 'Right.' }], answer: 'A', quote: 'a quote of four words', grounded }
}

function packAt(savedAt: string, title: string, questions: Question[] = [], topics: string[] = []): SavedPack {
  const pack: StudyPack = {
    title,
    overview: [],
    summary: topics.map((topic) => ({ topic, text: `${topic} point.`, quote: 'a quote of four words', grounded: true })),
    flashcards: [],
    questions,
    search_terms: [],
    uncovered: [],
    passage_count: 1,
    model: 'test-model',
  }
  return { ...newRecord(pack, { notes: '', transcript: null }), savedAt }
}

// Wednesday 11 November 2026, 10:00 in Kigali.
const wednesday = new Date(2026, 10, 11, 10)

describe('cutting weeks', () => {
  it('runs in Kigali time', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Africa/Kigali')
  })

  it('starts every day of a week, weekend included, on its Monday', () => {
    const monday = new Date(2026, 10, 9).getTime()
    for (let day = 9; day <= 15; day++) expect(weekStart(new Date(2026, 10, day, 23, 59)).getTime()).toBe(monday)
    expect(weekStart(new Date(2026, 10, 16, 0, 0)).getTime()).toBe(new Date(2026, 10, 16).getTime())
  })

  it('cuts weeks in local time, not UTC', () => {
    // 22:30 UTC on Sunday 15 November is 00:30 on Monday 16 November in Kigali: a new week.
    const [week] = groupByWeek([packAt('2026-11-15T22:30:00.000Z', 'Early Monday')], new Date(2026, 10, 16, 9))
    expect(week.key).toBe('2026-11-16')
    expect(week.packs.map((record) => record.pack.title)).toEqual(['Early Monday'])
  })

  it('puts a weekend round with the week just ended', () => {
    const weeks = groupByWeek([packAt('2026-11-14T08:00:00.000Z', 'Saturday round')], wednesday)
    expect(weeks).toHaveLength(1)
    expect(weeks[0].key).toBe('2026-11-09')
  })

  it('always offers the current week, newest first, sessions oldest first', () => {
    const weeks = groupByWeek(
      [packAt('2026-11-04T09:00:00.000Z', 'Later'), packAt('2026-11-02T09:00:00.000Z', 'Earlier')],
      wednesday,
    )
    expect(weeks.map((week) => week.key)).toEqual(['2026-11-09', '2026-11-02'])
    expect(weeks[0].packs).toEqual([])
    expect(weeks[1].packs.map((record) => record.pack.title)).toEqual(['Earlier', 'Later'])
  })

  it('names this week, last week and older weeks', () => {
    const [current, last, older] = groupByWeek(
      [packAt('2026-11-03T09:00:00.000Z', 'A'), packAt('2026-10-27T09:00:00.000Z', 'B')],
      wednesday,
    )
    expect(weekName(current, wednesday)).toBe('This week')
    expect(weekName(last, wednesday)).toBe('Last week')
    expect(weekName(older, wednesday)).toMatch(/^Week of /)
  })

  it('keeps a week that crosses the new year together, in date order', () => {
    const weeks = groupByWeek(
      [packAt('2026-12-31T09:00:00.000Z', 'Thursday 31st'), packAt('2027-01-02T09:00:00.000Z', 'Saturday 2nd')],
      new Date(2027, 0, 6, 10),
    )
    expect(weeks.map((week) => week.key)).toEqual(['2027-01-04', '2026-12-28'])
    expect(weeks[1].packs).toHaveLength(2)
    expect(weekName(weeks[1], new Date(2027, 0, 6))).toBe('Last week')
  })

  it('gives a pack dated in the future its own week, after the current one', () => {
    const weeks = groupByWeek([packAt('2026-11-20T09:00:00.000Z', 'Fast clock')], wednesday)
    expect(weeks.map((week) => week.key)).toEqual(['2026-11-16', '2026-11-09'])
    expect(weekName(weeks[1], wednesday)).toBe('This week')
  })

  it('names older weeks with their year when it is not this one', () => {
    const [, old] = groupByWeek([packAt('2025-11-04T09:00:00.000Z', 'A year ago')], wednesday)
    expect(weekName(old, wednesday)).toMatch(/2025/)
  })

  it('shows Monday to Friday', () => {
    const [week] = groupByWeek([], wednesday)
    expect(weekRange(week)).toMatch(/9.*13/)
  })

  it('is over on Friday at 18:00, local time', () => {
    const [week] = groupByWeek([], wednesday)
    expect(isOver(week, new Date(2026, 10, 13, 17, 59))).toBe(false)
    expect(isOver(week, new Date(2026, 10, 13, 18, 0))).toBe(true)
    expect(isOver(week, new Date(2026, 10, 15, 12))).toBe(true)
  })
})

describe('the week quiz', () => {
  const week = (packs: SavedPack[]): Week => ({ key: '2026-11-09', start: new Date(2026, 10, 9), packs })

  it('takes questions from each session in turn, checked ones only', () => {
    const monday = packAt('2026-11-09T09:00:00.000Z', 'Monday', [question('M1'), question('M2', false), question('M3')])
    const tuesday = packAt('2026-11-10T09:00:00.000Z', 'Tuesday', [question('T1')])
    const stems = weekQuiz(week([monday, tuesday])).map(({ question }) => question.stem)
    expect(stems).toEqual(['M1', 'T1', 'M3'])
  })

  it('stops at the most questions, and keeps where each came from', () => {
    const many = Array.from({ length: 8 }, (_, i) => question(`Q${i}`))
    const packs = [packAt('2026-11-09T09:00:00.000Z', 'One', many), packAt('2026-11-10T09:00:00.000Z', 'Two', many)]
    const quiz = weekQuiz(week(packs), 10)
    expect(quiz).toHaveLength(10)
    expect(quiz.map(({ from }) => from.pack.title).slice(0, 4)).toEqual(['One', 'Two', 'One', 'Two'])
  })

  it('is empty for a week without questions', () => {
    expect(weekQuiz(week([packAt('2026-11-09T09:00:00.000Z', 'Quizless')]))).toEqual([])
  })
})

describe('topics of a pack', () => {
  it('lists each topic once, in the order taught', () => {
    const record = packAt('2026-11-09T09:00:00.000Z', 'Round', [], ['Asthma', 'COPD', 'asthma ', 'Heart failure'])
    expect(topicsOf(record)).toEqual(['Asthma', 'COPD', 'Heart failure'])
  })

  it('has none for a pack written before topics existed, or with blank ones', () => {
    expect(topicsOf(packAt('2026-11-09T09:00:00.000Z', 'Old', [], ['', '  ']))).toEqual([])
  })
})
