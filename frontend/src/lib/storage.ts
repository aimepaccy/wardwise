import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ChatTurn, Question, StudyPack, WeekHighlights, WeekPoint } from '@/types'

// Study packs live in this browser's IndexedDB, never on WardWise's server. Export is the student's backup copy.

// The text a pack was written from (the corrected notes and transcript), kept with the pack
// so the student keeps their own words, and so the chat in phase 8 can answer from them.
export type PackMaterial = {
  notes: string
  transcript: string | null
}

export type SavedPack = {
  format: 1
  id: string
  savedAt: string
  // Imported packs were checked on another device, so WardWise says so rather than vouching for them.
  origin: 'written' | 'imported'
  pack: StudyPack
  material: PackMaterial
  // Questions asked about the pack, oldest first. Packs saved before 2026-11-11 have none.
  chat?: ChatTurn[]
}

// A week's highlights, kept because writing them costs an AI call and the words would differ each time.
// Everything else about a week is worked out from the packs when it is shown (lib/weeks.ts).
export type SavedWeek = {
  format: 1
  // The week's Monday, as YYYY-MM-DD in local time.
  key: string
  writtenAt: string
  // The packs it was written from, in the order sent: session n is sources[n - 1]. Compared with the week's
  // packs now (by id and savedAt) to tell whether the highlights are out of date.
  sources: { id: string; savedAt: string; title: string }[]
  // The points as sent, so each highlight can show what it rests on: point n is points[n - 1].
  points: WeekPoint[]
  highlights: WeekHighlights
}

export class StorageError extends Error {}

// Named before the app became WardWise. Renaming it would strand every pack already saved.
const DB_NAME = 'lucy'
// Version 2 (2026-11-11) adds the week highlights. Opening the database at a higher version runs `upgrade`
// once, in every browser that had the older one, before anything else can read or write.
const DB_VERSION = 2

interface WardWiseDB extends DBSchema {
  packs: { key: string; value: SavedPack; indexes: { 'by-saved': string } }
  weeks: { key: string; value: SavedWeek }
}

let opening: Promise<IDBPDatabase<WardWiseDB>> | null = null

function database() {
  opening ??= new Promise<IDBPDatabase<WardWiseDB>>((resolve, reject) => {
    let gaveUp = false
    openDB<WardWiseDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const packs = db.createObjectStore('packs', { keyPath: 'id' })
          packs.createIndex('by-saved', 'savedAt')
        }
        if (oldVersion < 2) db.createObjectStore('weeks', { keyPath: 'key' })
      },
      // Another tab, with a newer WardWise, wants to upgrade: let go, so it is not kept waiting. This tab opens
      // the database again on its next action (and would then need a reload to know the new layout).
      blocking() {
        void opening?.then((db) => db.close())
        opening = null
      },
      // A tab still running an older WardWise holds the database open and does not let go. Waiting would leave
      // every save hanging with no word, so the action fails with a reason instead.
      blocked() {
        gaveUp = true
        reject(new StorageError('WardWise is open in another tab with an older version. Close that tab, then try again.'))
      },
    }).then(
      (db) => {
        // Opened after all, once the other tab closed; this attempt was already given up, so let it go.
        if (gaveUp) db.close()
        else resolve(db)
      },
      reject,
    )
  }).catch((error) => {
    // Forget the failed attempt, so the next action tries again.
    opening = null
    throw error
  })
  return opening
}

export async function withDatabase<T>(work: (db: IDBPDatabase<WardWiseDB>) => Promise<T>): Promise<T> {
  try {
    return await work(await database())
  } catch (error) {
    if (error instanceof StorageError) throw error
    if (error instanceof DOMException && error.name === 'VersionError') {
      throw new StorageError('WardWise was updated in another tab. Reload this page to keep using your packs.')
    }
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new StorageError('This browser has no room left for study packs. Export and delete some older packs, then try again.')
    }
    throw new StorageError("WardWise could not use this browser's storage. Private windows and some privacy settings can block it.")
  }
}

// Random ids from getRandomValues, which works on plain http too (crypto.randomUUID needs https).
export function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function newRecord(pack: StudyPack, material: PackMaterial): SavedPack {
  return { format: 1, id: newId(), savedAt: new Date().toISOString(), origin: 'written', pack, material }
}

export function savePack(record: SavedPack) {
  return withDatabase(async (db) => {
    await db.put('packs', record)
  })
}

// Adds a quiz written later to the saved pack, in one transaction. Only to the same writing of the pack: if it
// was written again or deleted meanwhile, nothing changes and the answer is false.
export function addQuiz(record: SavedPack, questions: Question[]) {
  return withDatabase(async (db) => {
    const tx = db.transaction('packs', 'readwrite')
    const stored = await tx.store.get(record.id)
    const same = stored !== undefined && stored.savedAt === record.savedAt
    if (same) await tx.store.put({ ...stored, pack: { ...stored.pack, questions } })
    await tx.done
    return same
  })
}

// Keeps the chat with its pack, with the same rule as addQuiz: only the same writing of the pack, in one transaction.
export function saveChat(record: SavedPack, chat: ChatTurn[]) {
  return withDatabase(async (db) => {
    const tx = db.transaction('packs', 'readwrite')
    const stored = await tx.store.get(record.id)
    const same = stored !== undefined && stored.savedAt === record.savedAt
    if (same) await tx.store.put({ ...stored, chat })
    await tx.done
    return same
  })
}

// Newest first. The index keeps records sorted by date, so nothing is sorted here.
export function listPacks() {
  return withDatabase(async (db) => (await db.getAllFromIndex('packs', 'by-saved')).reverse())
}

// Highlights written from the pack go with it, so nothing of a deleted pack stays behind. If the deletion is
// undone, the week's highlights are written again the next time it is opened.
export function deletePack(id: string) {
  return withDatabase(async (db) => {
    const tx = db.transaction(['packs', 'weeks'], 'readwrite')
    await tx.objectStore('packs').delete(id)
    const weeks = tx.objectStore('weeks')
    for (const week of await weeks.getAll()) {
      if (week.sources.some((source) => source.id === id)) await weeks.delete(week.key)
    }
    await tx.done
  })
}

export function deleteAllPacks() {
  return withDatabase(async (db) => {
    const tx = db.transaction(['packs', 'weeks'], 'readwrite')
    await Promise.all([tx.objectStore('packs').clear(), tx.objectStore('weeks').clear(), tx.done])
  })
}

export function getWeek(key: string) {
  return withDatabase(async (db) => (await db.get('weeks', key)) ?? null)
}

// Saves the week's highlights only if every pack they were written from is still saved, unchanged. A write can
// take a minute; a pack deleted meanwhile must not have its points kept in highlights. The answer says whether
// they were saved.
export function saveWeek(record: SavedWeek) {
  return withDatabase(async (db) => {
    const tx = db.transaction(['packs', 'weeks'], 'readwrite')
    const packs = tx.objectStore('packs')
    const found = await Promise.all(record.sources.map((source) => packs.get(source.id)))
    const unchanged = found.every((pack, index) => pack !== undefined && pack.savedAt === record.sources[index].savedAt)
    if (unchanged) await tx.objectStore('weeks').put(record)
    await tx.done
    return unchanged
  })
}

// Asks the browser not to clear the packs when space runs short. It decides, and some browsers ask the student.
export async function askToKeepPacks() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    // Not supported here; packs are still saved, just with the browser's usual rules.
  }
}

// Export: the student's copy of their packs as one JSON file. Import is in import-packs.ts.

export function exportBlob(records: SavedPack[]) {
  const file = { app: 'wardwise', format: 1, exportedAt: new Date().toISOString(), packs: records }
  return new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
}
