import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ChatTurn, Question, StudyPack } from '@/types'

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

export class StorageError extends Error {}

// Named before the app became WardWise. Renaming it would strand every pack already saved.
const DB_NAME = 'lucy'
const DB_VERSION = 1

interface WardWiseDB extends DBSchema {
  packs: { key: string; value: SavedPack; indexes: { 'by-saved': string } }
}

let opening: Promise<IDBPDatabase<WardWiseDB>> | null = null

function database() {
  opening ??= openDB<WardWiseDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const packs = db.createObjectStore('packs', { keyPath: 'id' })
        packs.createIndex('by-saved', 'savedAt')
      }
    },
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

export function deletePack(id: string) {
  return withDatabase((db) => db.delete('packs', id))
}

export function deleteAllPacks() {
  return withDatabase((db) => db.clear('packs'))
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
