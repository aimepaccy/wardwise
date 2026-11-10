import { z } from 'zod'
import { StorageError, withDatabase, type SavedPack } from '@/lib/storage'
import type { StudyPack } from '@/types'

// Kept out of storage.ts so the browser downloads Zod only when the student presses Import.

const MAX_IMPORT_MB = 25
const MAX_IMPORT_PACKS = 1000
// The server's own limit for a reading search term.
const MAX_TERM_CHARS = 120

// Caps sit well above anything a written pack holds, so a genuine backup always restores; they are there
// to stop a crafted file from filling the browser, not to judge content.
const text = (max: number) => z.string().max(max)
const short = text(2_000)
const long = text(20_000)
const grounded = z.boolean()

const studyPack = z
  .object({
    title: short,
    overview: z.array(long).max(50),
    summary: z.array(z.object({ topic: short.optional(), text: long, quote: long, grounded })).max(200),
    flashcards: z.array(z.object({ front: long, back: long, quote: long, grounded })).max(200),
    questions: z
      .array(
        z
          .object({
            stem: long,
            options: z.array(z.object({ text: long, explanation: long })).min(2).max(5),
            answer: z.enum(['A', 'B', 'C', 'D', 'E']),
            quote: long,
            grounded,
          })
          // The answer must be one of the options, or the quiz would have no right answer.
          .refine((question) => 'ABCDE'.indexOf(question.answer) < question.options.length),
      )
      .max(200),
    // Held to the generator's rules: short, no links, no repeats. Others are dropped, not refused.
    search_terms: z.array(short).max(100).transform(cleanTerms),
    uncovered: z.array(long).max(2_000),
    passage_count: z.number().int().min(0).max(100_000),
    model: short,
  })
  // Fails to compile if this check and the StudyPack type ever disagree.
  .transform((pack): StudyPack => pack)

const savedPack = z.object({
  format: z.literal(1),
  id: z.string().regex(/^[\w-]{1,64}$/),
  savedAt: z.iso.datetime(),
  origin: z.enum(['written', 'imported']),
  pack: studyPack,
  material: z.object({
    notes: text(100_000),
    transcript: text(1_000_000).nullable(),
  }),
})

// The outside is checked first; each pack is then checked on its own, so one damaged pack does not
// keep the rest of a backup out.
const exportFile = z.object({
  // Backups made before the rename say 'lucy'.
  app: z.enum(['wardwise', 'lucy']),
  format: z.literal(1),
  exportedAt: z.iso.datetime(),
  packs: z.array(z.unknown()).max(MAX_IMPORT_PACKS),
})

function cleanTerms(terms: string[]) {
  const seen = new Set<string>()
  return terms.filter((term) => {
    const key = term.trim().toLowerCase()
    if (!key || key.length > MAX_TERM_CHARS || /https?:|www\./.test(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// --- Grounding, checked again ---
// A file can claim any item was found in its material. WardWise repeats the server's check (generate.py,
// _words and _locate) against the material in the file, and only ever turns "found" into "not found".

const SYMBOLS = '<>≤≥%±+'
const MIN_QUOTE_WORDS = 4
const MIN_PIECE_WORDS = 3
const MAX_GAP_WORDS = 40

function words(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(new RegExp(`([${SYMBOLS}])`, 'g'), ' $1 ')
    .replace(new RegExp(`[^\\p{L}\\p{N}_${SYMBOLS}]+`, 'gu'), ' ')
    .split(' ')
    .filter(Boolean)
}

function findRun(source: string[], piece: string[], from: number) {
  for (let i = from; i + piece.length <= source.length; i++) {
    if (piece.every((word, j) => source[i + j] === word)) return i
  }
  return -1
}

export function isGrounded(quote: string, source: string[]) {
  const pieces = quote.split(/\.\.\.|…/).map(words).filter((piece) => piece.length > 0)
  const total = pieces.reduce((sum, piece) => sum + piece.length, 0)
  if (total < MIN_QUOTE_WORDS || pieces.some((piece) => piece.length < MIN_PIECE_WORDS)) return false
  let position: number | null = null
  for (const piece of pieces) {
    const found = findRun(source, piece, position ?? 0)
    if (found === -1 || (position !== null && found - position > MAX_GAP_WORDS)) return false
    position = found + piece.length
  }
  return true
}

function recheck(record: SavedPack): SavedPack {
  const { notes, transcript } = record.material
  const source = words([notes, transcript ?? ''].join('\n'))
  const check = <T extends { quote: string; grounded: boolean }>(item: T): T => ({
    ...item,
    grounded: item.grounded && isGrounded(item.quote, source),
  })
  const { pack } = record
  return {
    ...record,
    origin: 'imported',
    pack: { ...pack, summary: pack.summary.map(check), flashcards: pack.flashcards.map(check), questions: pack.questions.map(check) },
  }
}

export type ImportResult = { added: number; alreadyHere: number; unreadable: number }

export async function importPacks(file: File): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_MB * 1024 * 1024) {
    throw new StorageError(`This file is larger than ${MAX_IMPORT_MB} MB, too large to be a WardWise export.`)
  }
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new StorageError('This file is not a WardWise export. Nothing was imported.')
  }
  const parsed = exportFile.safeParse(data)
  if (!parsed.success) throw new StorageError('This file is not a WardWise export. Nothing was imported.')

  const records: SavedPack[] = []
  let unreadable = 0
  for (const item of parsed.data.packs) {
    const pack = savedPack.safeParse(item)
    if (pack.success) records.push(recheck(pack.data))
    else unreadable += 1
  }

  // One transaction: if anything fails part way (a full disk), nothing from the file is kept.
  return withDatabase(async (db) => {
    const transaction = db.transaction('packs', 'readwrite')
    const result: ImportResult = { added: 0, alreadyHere: 0, unreadable }
    try {
      for (const record of records) {
        // Same id: a pack this browser already has (an earlier import, or its own export), so it is left alone.
        if ((await transaction.store.getKey(record.id)) !== undefined) {
          result.alreadyHere += 1
          continue
        }
        await transaction.store.add(record)
        result.added += 1
      }
    } catch (error) {
      // A failed request ends the transaction, so its own promise rejects too; this error is the one to report.
      void transaction.done.catch(() => {})
      throw error
    }
    await transaction.done
    return result
  })
}
