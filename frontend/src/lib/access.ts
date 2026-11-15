// The access code for a hosted copy of WardWise, remembered in this browser so it is asked for only once.
// A convenience, not a safeguard: if storage is blocked, the code is kept in memory and asked for again next visit.
const KEY = 'wardwise-access-code'
const NEEDED = 'wardwise:access-needed'

let inMemory: string | null = null

export function accessCode(): string | null {
  try {
    return localStorage.getItem(KEY) ?? inMemory
  } catch {
    return inMemory
  }
}

export function rememberCode(code: string) {
  inMemory = code
  try {
    localStorage.setItem(KEY, code)
  } catch {
    // Kept in memory for this visit only.
  }
}

export function forgetCode() {
  inMemory = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing was stored.
  }
}

// The server turned a request away for want of the right code: whoever shows the code box should open it.
export function announceCodeNeeded() {
  window.dispatchEvent(new Event(NEEDED))
}

export function onCodeNeeded(listener: () => void) {
  window.addEventListener(NEEDED, listener)
  return () => window.removeEventListener(NEEDED, listener)
}
