import { beforeEach, describe, expect, it } from 'vitest'
import { importPacks } from '@/lib/import-packs'
import { StorageError, deleteAllPacks, deletePack, exportBlob, listPacks, newRecord, savePack, type SavedPack } from '@/lib/storage'
import type { StudyPack } from '@/types'

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
