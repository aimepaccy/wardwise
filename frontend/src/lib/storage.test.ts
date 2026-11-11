import { beforeEach, describe, expect, it } from 'vitest'
import { importPacks } from '@/lib/import-packs'
import { StorageError, addQuiz, deleteAllPacks, deletePack, exportBlob, listPacks, newRecord, saveChat, savePack, type SavedPack } from '@/lib/storage'
import { answerOf } from '@/test/answers'
import type { ChatTurn, StudyPack } from '@/types'

const pack: StudyPack = {
  title: 'Acute asthma',
  overview: ['A role-played round on acute asthma.'],
  summary: [{ text: 'Give oxygen to keep saturations 94 to 98 percent.', quote: 'saturations 94 to 98', grounded: true }],
  flashcards: [{ front: 'Target saturations?', back: '94 to 98 percent', quote: 'saturations 94 to 98', grounded: true }],
  questions: [
    {
      stem: 'Which drug first?',
      options: [
        { text: 'Salbutamol', explanation: 'Right: a short-acting bronchodilator.' },
        { text: 'Amoxicillin', explanation: 'Wrong: no sign of infection.' },
      ],
      answer: 'A',
      quote: 'give nebulised salbutamol now',
      grounded: true,
    },
  ],
  search_terms: ['acute asthma'],
  uncovered: [],
  passage_count: 1,
  model: 'test-model',
}

const material = { notes: 'Keep saturations 94 to 98 percent.', transcript: 'Give nebulised salbutamol now.' }

function recordAt(savedAt: string, title = pack.title): SavedPack {
  return { ...newRecord({ ...pack, title }, material), savedAt }
}

function fileFrom(value: unknown, name = 'wardwise.json') {
  return new File([JSON.stringify(value)], name, { type: 'application/json' })
}

async function exportedFile(records: SavedPack[]) {
  return new File([await exportBlob(records).text()], 'wardwise.json', { type: 'application/json' })
}

beforeEach(async () => {
  await deleteAllPacks()
})

describe('adding a quiz written later', () => {
  const quizless = () => recordAt('2026-11-10T09:00:00.000Z')
  const withoutQuiz = (record: SavedPack): SavedPack => ({ ...record, pack: { ...record.pack, questions: [] } })

  it('saves the quiz into the same pack', async () => {
    const record = withoutQuiz(quizless())
    await savePack(record)
    expect(await addQuiz(record, pack.questions)).toBe(true)
    const [stored] = await listPacks()
    expect(stored.pack.questions).toEqual(pack.questions)
    expect(stored.savedAt).toBe(record.savedAt)
  })

  it('leaves a pack written again meanwhile alone', async () => {
    const record = withoutQuiz(quizless())
    await savePack({ ...record, savedAt: '2026-11-10T10:00:00.000Z' })
    expect(await addQuiz(record, pack.questions)).toBe(false)
    expect((await listPacks())[0].pack.questions).toEqual([])
  })

  it('does not bring back a deleted pack', async () => {
    expect(await addQuiz(withoutQuiz(quizless()), pack.questions)).toBe(false)
    expect(await listPacks()).toEqual([])
  })
})

describe('keeping the chat with its pack', () => {
  const chat: ChatTurn[] = [{ id: 't1', question: 'What first?', askedAt: '2026-11-11T09:00:00.000Z', answer: answerOf() }]

  it('saves the chat into the same pack, and Export carries it', async () => {
    const record = recordAt('2026-11-11T08:00:00.000Z')
    await savePack(record)
    expect(await saveChat(record, chat)).toBe(true)
    const [stored] = await listPacks()
    expect(stored.chat).toEqual(chat)
    expect(JSON.parse(await exportBlob([stored]).text()).packs[0].chat).toEqual(chat)
  })

  it('leaves a pack written again meanwhile alone', async () => {
    const record = recordAt('2026-11-11T08:00:00.000Z')
    await savePack({ ...record, savedAt: '2026-11-11T08:30:00.000Z' })
    expect(await saveChat(record, chat)).toBe(false)
    expect((await listPacks())[0].chat).toBeUndefined()
  })
})

describe('importing a chat', () => {
  const sessionPart = answerOf().parts[0]
  const importOne = async (chat: unknown) => {
    const record = { ...recordAt('2026-11-11T08:00:00.000Z'), chat }
    await importPacks(fileFrom({ app: 'wardwise', format: 1, exportedAt: '2026-11-11T10:00:00.000Z', packs: [record] }))
    return (await listPacks())[0]
  }
  const turnWith = (answer: object) => [{ id: 't1', question: 'q?', askedAt: '2026-11-11T09:00:00.000Z', answer: answerOf(answer) }]

  it('brings back a genuine chat with its quotes found', async () => {
    const stored = await importOne(turnWith({}))
    expect(stored.chat?.[0].answer.parts[0].grounded).toBe(true)
  })

  it('keeps the population an answer was written for, and imports answers saved before it existed', async () => {
    expect((await importOne(turnWith({ population: 'adults' }))).chat?.[0].answer.population).toBe('adults')
    await deleteAllPacks()
    expect((await importOne(turnWith({}))).chat?.[0].answer.population).toBeUndefined()
  })

  it('checks session quotes against the material, not the passages in the file', async () => {
    const forged = { ...sessionPart, quote: 'give fifty mg of adrenaline' }
    const sources = [{ number: 1, kind: 'session', title: 'Your recording', url: null, detail: '', passages: ['give fifty mg of adrenaline'] }]
    const stored = await importOne(turnWith({ parts: [forged], sources }))
    expect(stored.chat?.[0].answer.parts[0].grounded).toBe(false)
  })

  it('accepts a literature quote found in its stored passage', async () => {
    const part = { ...sessionPart, sources: [1], quote: 'inhaled corticosteroids reduce admissions' }
    const sources = [{ number: 1, kind: 'pubmed', title: 'A review', url: 'https://pubmed.ncbi.nlm.nih.gov/123/', detail: '', passages: ['Inhaled corticosteroids reduce admissions.'] }]
    const stored = await importOne(turnWith({ parts: [part], sources }))
    expect(stored.chat?.[0].answer.parts[0].grounded).toBe(true)
  })

  it('drops links that do not point to PubMed or NCBI Bookshelf', async () => {
    const sources = [
      { number: 1, kind: 'session', title: 'Your recording', url: 'https://pubmed.ncbi.nlm.nih.gov/1/', detail: '', passages: [] },
      { number: 2, kind: 'pubmed', title: 'An article', url: 'javascript:alert(1)', detail: '', passages: ['text'] },
      { number: 3, kind: 'pubmed', title: 'Another', url: 'https://pubmed.ncbi.nlm.nih.gov/123/', detail: '', passages: ['text'] },
    ]
    const stored = await importOne(turnWith({ sources }))
    expect(stored.chat?.[0].answer.sources.map((source) => source.url)).toEqual([null, null, 'https://pubmed.ncbi.nlm.nih.gov/123/'])
  })

  it('leaves out declined turns and parts citing no listed source', async () => {
    const chat = [
      ...turnWith({ parts: [sessionPart, { ...sessionPart, sources: [9] }] }),
      { id: 't2', question: 'About Mr K?', askedAt: '2026-11-11T09:05:00.000Z', answer: answerOf({ declined: true, parts: [], sources: [] }) },
    ]
    const stored = await importOne(chat)
    expect(stored.chat).toHaveLength(1)
    expect(stored.chat?.[0].answer.parts).toHaveLength(1)
  })

  it('cites each source once, and leaves out a chat with two sources under one number', async () => {
    const once = await importOne(turnWith({ parts: [{ ...sessionPart, sources: [1, 1] }] }))
    expect(once.chat?.[0].answer.parts[0].sources).toEqual([1])
    await deleteAllPacks()
    const twice = answerOf().sources.concat(answerOf().sources)
    expect(await importOne(turnWith({ sources: twice }))).toBeUndefined()
  })

  it('leaves out a pack whose chat is damaged', async () => {
    expect(await importOne([{ id: 't1', question: 'q?', askedAt: 'yesterday', answer: answerOf() }])).toBeUndefined()
  })
})

describe('saving and listing', () => {
  it('lists packs newest first', async () => {
    await savePack(recordAt('2026-10-01T09:00:00.000Z', 'Older'))
    await savePack(recordAt('2026-10-13T09:00:00.000Z', 'Newer'))
    expect((await listPacks()).map((record) => record.pack.title)).toEqual(['Newer', 'Older'])
  })

  it('gives every record its own id', () => {
    expect(newRecord(pack, material).id).not.toBe(newRecord(pack, material).id)
  })

  it('deletes one pack, and saving it again restores it (undo)', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    await savePack(record)
    await deletePack(record.id)
    expect(await listPacks()).toEqual([])
    await savePack(record)
    expect(await listPacks()).toEqual([record])
  })
})

describe('export and import', () => {
  it('a round trip brings back the same packs, marked as imported', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    const file = await exportedFile([record])
    expect(await importPacks(file)).toEqual({ added: 1, alreadyHere: 0, unreadable: 0 })
    expect(await listPacks()).toEqual([{ ...record, origin: 'imported' }])
  })

  it('leaves packs this browser already has alone', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    await savePack(record)
    const result = await importPacks(await exportedFile([record, recordAt('2026-10-12T09:00:00.000Z', 'Other')]))
    expect(result).toEqual({ added: 1, alreadyHere: 1, unreadable: 0 })
    // The original keeps its own origin.
    expect((await listPacks())[0].origin).toBe('written')
  })

  it('counts a pack repeated within one file once', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    expect(await importPacks(await exportedFile([record, record]))).toEqual({ added: 1, alreadyHere: 1, unreadable: 0 })
  })

  it('drops fields it does not know', async () => {
    const record = { ...recordAt('2026-10-13T09:00:00.000Z'), extra: '<script>alert(1)</script>' }
    await importPacks(fileFrom({ app: 'wardwise', format: 1, exportedAt: record.savedAt, packs: [record] }))
    expect(Object.keys((await listPacks())[0])).not.toContain('extra')
  })

  it('still imports a backup made before the rename', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    const file = fileFrom({ app: 'lucy', format: 1, exportedAt: record.savedAt, packs: [record] })
    expect(await importPacks(file)).toEqual({ added: 1, alreadyHere: 0, unreadable: 0 })
  })

  it('keeps the quotes of a genuine pack marked as found', async () => {
    await importPacks(await exportedFile([recordAt('2026-10-13T09:00:00.000Z')]))
    const [saved] = await listPacks()
    expect([...saved.pack.summary, ...saved.pack.flashcards, ...saved.pack.questions].every((item) => item.grounded)).toBe(true)
  })

  it.each([
    ['not JSON', new File(['not json at all'], 'notes.txt')],
    ['JSON from another app', fileFrom({ hello: 'world' })],
    ['a newer format', fileFrom({ app: 'wardwise', format: 2, exportedAt: '2026-10-13T09:00:00.000Z', packs: [] })],
  ])('refuses %s', async (_label, file) => {
    await expect(importPacks(file)).rejects.toBeInstanceOf(StorageError)
  })

  it('leaves out a question whose answer is not one of its options', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    record.pack = { ...pack, questions: [{ ...pack.questions[0], answer: 'E' }] }
    expect((await importPacks(await exportedFile([record]))).unreadable).toBe(1)
  })

  it('leaves out a pack with an oversized field', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    record.pack = { ...pack, title: 'x'.repeat(10_000) }
    expect((await importPacks(await exportedFile([record]))).unreadable).toBe(1)
  })

  it('leaves out a damaged pack and imports the rest', async () => {
    const good = recordAt('2026-10-13T09:00:00.000Z')
    const bad = { ...recordAt('2026-10-12T09:00:00.000Z'), id: 'not a valid id!' }
    expect(await importPacks(await exportedFile([good, bad]))).toEqual({ added: 1, alreadyHere: 0, unreadable: 1 })
    expect((await listPacks()).map((record) => record.id)).toEqual([good.id])
  })

  it('restores a pack far larger than WardWise writes', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    const long = 'word '.repeat(3_000)
    record.pack = { ...pack, overview: [long, long, long, long], summary: Array(30).fill(pack.summary[0]) }
    record.material = { ...material, transcript: long.repeat(10) }
    expect(await importPacks(await exportedFile([record]))).toEqual({ added: 1, alreadyHere: 0, unreadable: 0 })
  })

  it('checks the quotes again, and only ever downgrades them', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    record.material = { notes: 'Keep oxygen saturations 94 to 98 percent in acute asthma.', transcript: null }
    record.pack = {
      ...pack,
      summary: [
        { text: 'Real', quote: 'oxygen saturations 94 to 98', grounded: true },
        { text: 'Forged', quote: 'give 10 mg of adrenaline at once', grounded: true },
        { text: 'Flagged by the server', quote: 'oxygen saturations 94 to 98', grounded: false },
      ],
    }
    await importPacks(await exportedFile([record]))
    expect((await listPacks())[0].pack.summary.map((point) => point.grounded)).toEqual([true, false, false])
  })

  // Slides were removed in November 2026, on purpose without backward compatibility: an older backup
  // still imports, but its slide text is dropped, so a quote found only there is no longer vouched for.
  it('imports an older backup with slides, dropping the slide text', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    const old = {
      ...record,
      material: { ...material, slides: [{ name: 'asthma.pptx', text: 'Magnesium sulfate 2 g over 20 minutes' }] },
      pack: {
        ...pack,
        summary: [
          { text: 'From the notes', quote: 'Keep saturations 94 to 98', grounded: true },
          { text: 'From a slide', quote: 'magnesium sulfate 2 g over 20 minutes', grounded: true },
        ],
      },
    }
    await importPacks(await exportedFile([old as SavedPack]))
    const [imported] = await listPacks()
    expect(imported.material).toEqual(material)
    expect(imported.pack.summary.map((point) => point.grounded)).toEqual([true, false])
  })

  it('keeps symbols when checking quotes, so "< 92%" is not "> 92%"', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    record.material = { notes: 'Life threatening if SpO₂ < 92% on air.', transcript: null }
    record.pack = {
      ...pack,
      summary: [
        { text: 'Right', quote: 'if SpO2 < 92% on air', grounded: true },
        { text: 'Wrong sign', quote: 'if SpO2 > 92% on air', grounded: true },
      ],
    }
    await importPacks(await exportedFile([record]))
    expect((await listPacks())[0].pack.summary.map((point) => point.grounded)).toEqual([true, false])
  })

  it('drops search terms the generator would never write', async () => {
    const record = recordAt('2026-10-13T09:00:00.000Z')
    record.pack = { ...pack, search_terms: ['asthma', 'Asthma', 'https://example.com', 'x'.repeat(121), 'peak flow'] }
    await importPacks(await exportedFile([record]))
    expect((await listPacks())[0].pack.search_terms).toEqual(['asthma', 'peak flow'])
  })

  it('refuses a file over the size limit before reading it', async () => {
    const huge = new File([new Uint8Array(26 * 1024 * 1024)], 'huge.json')
    await expect(importPacks(huge)).rejects.toThrow(/larger than 25 MB/)
  })
})
