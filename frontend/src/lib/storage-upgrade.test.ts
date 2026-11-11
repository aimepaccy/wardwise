import { describe, expect, it } from 'vitest'

// A browser that saved packs with the first version of WardWise's database (packs only) opens it with
// version 2, which adds the week highlights. Its packs must still be there.
describe('upgrading the database', () => {
  it('keeps the packs saved before week highlights existed', async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('lucy')
      request.onsuccess = () => resolve()
    })
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('lucy', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('packs', { keyPath: 'id' }).createIndex('by-saved', 'savedAt')
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('packs', 'readwrite')
        tx.objectStore('packs').put({ id: 'old', savedAt: '2026-11-02T09:00:00.000Z', format: 1 })
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })

    const { getWeek, listPacks } = await import('@/lib/storage')
    expect((await listPacks()).map((record) => record.id)).toEqual(['old'])
    expect(await getWeek('2026-11-02')).toBeNull()
  })
})
