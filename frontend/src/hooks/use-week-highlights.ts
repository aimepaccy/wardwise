import { useEffect, useRef, useState } from 'react'
import { messageOf, waitForJob, writeHighlights } from '@/lib/api'
import { StorageError, getWeek, saveWeek, type SavedWeek } from '@/lib/storage'
import { highlightsBasis, highlightsRequest, planHighlights, type Week } from '@/lib/weeks'

export type HighlightsState =
  // The week is not over yet: highlights come on Friday at 18:00.
  | { status: 'locked' }
  | { status: 'loading' }
  // No checked teaching points this week, so nothing to write from.
  | { status: 'empty' }
  // `saved` is shown while it is written again (it is out of date), or null the first time.
  | { status: 'writing'; step: string; saved: SavedWeek | null }
  | { status: 'ready'; saved: SavedWeek; unsaved: string | null }
  // `saved`, if any, is out of date.
  | { status: 'error'; message: string; saved: SavedWeek | null }

// What this opening of the sheet knows, per week. Each opening (`now` is set when the sheet opens) starts
// afresh: what is saved is read again (another tab may have written), and a failure gets another try.
type Opening = {
  at: Date
  saved: Record<string, SavedWeek | null>
  failed: Record<string, string>
  // The packs already written for in this opening (highlightsBasis), so one opening never writes twice for the
  // same packs, whatever else goes wrong.
  tried: Record<string, string>
}

const fresh = (at: Date): Opening => ({ at, saved: {}, failed: {}, tried: {} })

// The highlights of the week on screen. Written automatically, with no button: once the week is over, the first
// time it is opened, and again when its packs have changed since. Never before Friday 18:00, one write at a time,
// and at most once per week per opening, to spare the AI allowance. The rules are in planHighlights.
export function useWeekHighlights(week: Week, now: Date, open: boolean, version: number) {
  const [opening, setOpening] = useState<Opening>(() => fresh(now))
  const [writing, setWriting] = useState<{ key: string; step: string } | null>(null)
  const [unsaved, setUnsaved] = useState<Record<string, string>>({})
  const busy = useRef(false)
  // The latest opening, for a write that finishes after the sheet was closed and opened again.
  const latestOpening = useRef(now)
  useEffect(() => {
    latestOpening.current = now
  }, [now])

  const known = opening.at === now ? opening : fresh(now)
  // Changes this opening only; a late answer from an earlier opening is dropped.
  const update = (at: Date, change: (current: Opening) => Partial<Opening>) =>
    setOpening((current) => {
      const base = current.at === now ? current : fresh(now)
      return at === now ? { ...base, ...change(base) } : base
    })

  const request = highlightsRequest(week)
  const saved = known.saved[week.key]
  const plan = planHighlights({
    week,
    now,
    hasPoints: request.points.length > 0,
    saved,
    failed: week.key in known.failed,
    tried: known.tried[week.key],
  })

  // Read when the sheet opens and after a pack is saved. A read that comes back after a newer write is ignored.
  const over = plan !== 'locked'
  useEffect(() => {
    if (!open || !over) return
    let latest = true
    const at = now
    const settle = (record: SavedWeek | null) =>
      latest &&
      update(at, (current) => {
        const held = current.saved[week.key]
        const newer = held && (!record || held.writtenAt > record.writtenAt)
        return { saved: { ...current.saved, [week.key]: newer ? held : record } }
      })
    getWeek(week.key).then(settle, () => settle(null))
    return () => {
      latest = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, over, week.key, version, now])

  const idle = writing === null
  const needed = open && plan === 'write'
  useEffect(() => {
    if (!needed || busy.current) return
    busy.current = true
    const at = now
    const key = week.key
    const basis = highlightsBasis(week)
    const sources = week.packs.slice(0, request.sessions.length).map(({ id, savedAt, pack }) => ({ id, savedAt, title: pack.title }))
    update(at, (current) => ({ tried: { ...current.tried, [key]: basis } }))
    setWriting({ key, step: 'Sending to WardWise' })
    void (async () => {
      try {
        const { job_id } = await writeHighlights(request)
        const job = await waitForJob(job_id, (step) => setWriting({ key, step }))
        if (!job.highlights) throw new Error('WardWise could not write the highlights.')
        const record: SavedWeek = { format: 1, key, writtenAt: new Date().toISOString(), sources, points: request.points, highlights: job.highlights }
        let kept: boolean
        try {
          // False if a pack it was written from was deleted or written again meanwhile: then nothing is kept.
          kept = await saveWeek(record)
          setUnsaved((all) => without(all, key))
        } catch (error) {
          // Shown, but only in this page: it will be written again next time.
          kept = true
          setUnsaved((all) => ({ ...all, [key]: error instanceof StorageError ? error.message : 'They could not be saved in this browser.' }))
        }
        // Into whichever opening is current by now, so a reopened sheet shows it rather than writing again.
        if (kept)
          setOpening((current) => {
            const base = current.at === latestOpening.current ? current : fresh(latestOpening.current)
            return { ...base, saved: { ...base.saved, [key]: record } }
          })
      } catch (error) {
        update(at, (current) => ({ failed: { ...current.failed, [key]: messageOf(error) } }))
      } finally {
        busy.current = false
        setWriting(null)
      }
    })()
    // `request` and `week` are read when the write starts; a change to them changes `plan`.
    // `idle` brings a week that waited for another week's write back to its turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed, week.key, idle])

  // Try again: the failure is forgotten, and so is the one-write guard, since the student asked.
  function retry() {
    update(now, (current) => ({ failed: without(current.failed, week.key), tried: without(current.tried, week.key) }))
  }

  const kept = saved ?? null
  let state: HighlightsState
  if (plan === 'locked') state = { status: 'locked' }
  else if (writing?.key === week.key) state = { status: 'writing', step: writing.step, saved: kept }
  else if (plan === 'current') state = { status: 'ready', saved: saved!, unsaved: unsaved[week.key] ?? null }
  else if (plan === 'empty') state = { status: 'empty' }
  else if (plan === 'failed') state = { status: 'error', message: known.failed[week.key], saved: kept }
  // Written once in this opening and still not matching (a pack changed while it was written): say so, no loop.
  else if (plan === 'tried') state = { status: 'error', message: 'The week changed while its highlights were being written.', saved: kept }
  else if (writing) state = { status: 'writing', step: 'Waiting for another week to finish', saved: kept }
  else state = { status: 'loading' }
  return { state, retry }
}

function without(record: Record<string, string>, key: string) {
  const copy = { ...record }
  delete copy[key]
  return copy
}
