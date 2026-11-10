import type { JobCreated, JobState, Limits, Materials, NotePhoto, Reading, Recording } from '@/types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
// Long enough for a long recording and five photos on slow Wi-Fi.
const UPLOAD_TIMEOUT_MS = 5 * 60_000
const CHECK_TIMEOUT_MS = 15_000
const POLL_EVERY_MS = 1500
const JOB_TIMEOUT_MS = 10 * 60_000
// The server gives each reading source 12 seconds; a little more covers the trip there and back.
const READING_TIMEOUT_MS = 20_000

export class ApiError extends Error {
  status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.status = status
  }
}

const SLOW_UPLOAD = 'WardWise took too long to answer. Check your connection, or send fewer or smaller files.'

async function request<T>(path: string, init: RequestInit, timeoutMs: number, slowMessage = SLOW_UPLOAD): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new ApiError(slowMessage)
    throw new ApiError('WardWise could not reach its server. Check that it is running, then try again.')
  }

  if (!response.ok) throw new ApiError(await readError(response), response.status)
  return response.json()
}

export function sendSession(recording: Recording | null, photos: NotePhoto[]): Promise<JobCreated> {
  // FormData becomes a multipart request. The browser sets the Content-Type header,
  // including the boundary that separates the parts, so we must not set it ourselves.
  const body = new FormData()
  if (recording) body.append('audio', recording.file, recording.name)
  for (const photo of photos) body.append('photos', photo.file)

  return request<JobCreated>('/api/sessions', { method: 'POST', body }, UPLOAD_TIMEOUT_MS)
}

export function getLimits(): Promise<Limits> {
  return request<Limits>('/api/limits', {}, CHECK_TIMEOUT_MS)
}

// Plain JSON this time: only text goes, the student's corrected copy of what WardWise heard and read.
export function writePack(materials: Materials): Promise<{ job_id: string }> {
  const body = JSON.stringify({ notes: materials.notes ?? '', transcript: materials.transcript })
  return request('/api/packs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, CHECK_TIMEOUT_MS)
}

// A GET with the term in the address: the server only looks things up, nothing is stored or changed.
export function findReading(term: string): Promise<Reading> {
  const slow = 'WardWise took too long to find reading for this term. Please try again.'
  return request<Reading>(`/api/reading?term=${encodeURIComponent(term)}`, {}, READING_TIMEOUT_MS, slow)
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

// Polling: ask "is it ready yet?" every 1.5 seconds until the job is done, has failed, or takes too long.
export async function waitForJob(jobId: string, onStep: (step: string) => void): Promise<JobState> {
  const giveUpAt = Date.now() + JOB_TIMEOUT_MS
  let failedChecks = 0
  while (Date.now() < giveUpAt) {
    let job: JobState
    try {
      job = await request<JobState>(`/api/jobs/${jobId}`, {}, CHECK_TIMEOUT_MS)
      failedChecks = 0
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new ApiError("WardWise's server restarted before it finished. Please send again.")
      }
      // A dropped check (no answer at all) may be a Wi-Fi blip: try again, up to three times in a row.
      const noAnswer = error instanceof ApiError && error.status === null
      failedChecks += 1
      if (!noAnswer || failedChecks === 3) throw error
      await wait(POLL_EVERY_MS)
      continue
    }
    if (job.status === 'done') return job
    if (job.status === 'failed') throw new ApiError(job.error ?? 'Something went wrong. Please try again.')
    onStep(job.step)
    await wait(POLL_EVERY_MS)
  }
  throw new ApiError('WardWise is taking longer than expected. Please try again.')
}

// FastAPI sends errors as { detail: "message" }, or { detail: [...] } for validation errors.
async function readError(response: Response) {
  const fallback = `Something went wrong (error ${response.status}). Please try again.`
  try {
    const { detail } = await response.json()
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
  } catch {
    // Not JSON, for example an error page from a proxy.
  }
  return fallback
}
