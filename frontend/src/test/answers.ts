import type { Answer } from '@/types'

// A small answer for tests, quoting the test material "Give nebulised salbutamol now."
export function answerOf(overrides: Partial<Answer> = {}): Answer {
  return {
    question: 'What did the session give first?',
    parts: [
      { text: 'In your session, nebulised salbutamol.', sources: [1], quote: 'give nebulised salbutamol now', grounded: true, group_unclear: false },
    ],
    sources: [{ number: 1, kind: 'session', title: 'Your recording', url: null, detail: '', passages: ['Give nebulised salbutamol now.'] }],
    disagree: false,
    group: '',
    declined: false,
    searched: ['salbutamol asthma'],
    notes: [],
    model: 'test-model',
    ...overrides,
  }
}
