import type { Materials } from '@/types'

// Derived from the two versions, never stored.
export function hasCorrections(heard: Materials, draft: Materials) {
  return draft.transcript !== heard.transcript || draft.notes !== heard.notes
}

// Anything WardWise heard or read for the student to check: a transcript or notes read from photos.
export function hasReviewable(materials: Materials) {
  return materials.transcript !== null || materials.notes !== null
}

// Whether the student stops to check what WardWise heard and read: text to correct, or warnings to see.
// One rule for the panel, the steps and the automatic writing, so they always agree.
export function needsCheck(materials: Materials) {
  return hasReviewable(materials) || materials.warnings.length > 0
}
