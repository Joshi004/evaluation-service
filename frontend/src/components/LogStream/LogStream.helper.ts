// Non-DOM half of LogStream.tsx: owns the EventSource connecting to
// GET /api/v1/runs/{id}/logs?source=... (services/runs/logs.py) and a
// bounded ring of the lines it has received.

import { useEffect, useRef, useState } from 'react'
import { API_BASE } from '../../api/client'

export type LogSource = 'harness' | 'endpoint'

// Caps a tab's memory on a log left open a long time -- the server
// side of this same trade-off is services/runs/logs.py's own _TAIL_LINES
// bound on what a fresh connection starts from.
const MAX_BUFFERED_LINES = 2000

export interface LogLine {
  id: number
  text: string
}

export interface UseRunLogStreamResult {
  lines: LogLine[]
  connectionError: string | null
}

// Callers must remount this hook (via LogStream's own `key` prop -- see
// its docstring) whenever `runId` or `source` should start a fresh
// stream. This intentionally never resets `lines`/`connectionError`
// itself on a runId/source change: doing that with a synchronous
// setState at the top of the effect works, but React's own guidance for
// "reset this state when an identity changes" is to remount via `key`,
// not to reach back into the effect to clear state by hand.
export function useRunLogStream(runId: number, source: LogSource): UseRunLogStreamResult {
  const [lines, setLines] = useState<LogLine[]>([])
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const nextLineId = useRef(0)

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/runs/${runId}/logs?source=${source}`)

    eventSource.onopen = () => {
      setConnectionError(null)
    }

    eventSource.onmessage = (event: MessageEvent<string>) => {
      const id = nextLineId.current
      nextLineId.current += 1
      setLines((previous) => {
        const next = [...previous, { id, text: event.data }]
        return next.length > MAX_BUFFERED_LINES
          ? next.slice(next.length - MAX_BUFFERED_LINES)
          : next
      })
    }

    eventSource.onerror = () => {
      // CLOSED means the browser gave up for good (e.g. the initial
      // response wasn't a 200 text/event-stream -- a 404 for a run that
      // doesn't exist) and will not retry on its own. Any other state
      // is a transient drop mid-stream that EventSource already retries
      // itself with its own backoff -- T3 is about *this* hook closing
      // the connection on unmount, not about closing it on a drop.
      setConnectionError(
        eventSource.readyState === EventSource.CLOSED
          ? 'Log stream closed -- the run may no longer exist.'
          : 'Reconnecting to log stream…',
      )
    }

    return () => {
      eventSource.close()
    }
  }, [runId, source])

  return { lines, connectionError }
}
