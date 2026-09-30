// Turns a run's raw error string into a plain-language title plus an
// optional hint of what to check next -- never guessing a root cause
// the message doesn't state. Every pattern below is something the
// harness's own message actually says, not an inference; an error
// this frontend doesn't recognise yet gets the generic title with its
// raw text still attached, never dropped.
export interface RunErrorClassification {
  title: string
  hint: string | null
  raw: string
}

interface ErrorPattern {
  matches: (error: string) => boolean
  title: string
  hint: string
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    // All six failed runs in the real data show exactly this shape: a
    // FileNotFoundError for .../reports/<model>/<benchmark>.json -- the
    // harness process exited before it ever wrote a results report.
    matches: (error) => error.includes('FileNotFoundError') && /reports\/.+\.json/.test(error),
    title: 'The run ended without a results report',
    hint: 'The harness stopped before writing its results. Open the Logs tab to see why.',
  },
]

const GENERIC_TITLE = 'The run failed'

export function classifyRunError(error: string | null): RunErrorClassification | null {
  if (error === null || error.trim() === '') {
    return null
  }
  const pattern = ERROR_PATTERNS.find((candidate) => candidate.matches(error))
  return {
    title: pattern?.title ?? GENERIC_TITLE,
    hint: pattern?.hint ?? null,
    raw: error,
  }
}
