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

// The harness's own log lines carry ANSI colour codes meant for a
// terminal (evalscope's logger writes e.g. "\x1b[32mINFO\x1b[0m") --
// stripped here so a line reads as plain text in a styled <div> instead
// of the raw escape sequence. \x1b (ESC, 0x1b) is the actual byte an
// SGR colour code starts with, not a stray control character caught by
// accident.
// oxlint-disable-next-line no-control-regex
const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/g

function stripAnsiCodes(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, '')
}

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
//
// `runIsFinished` breaks a real reconnect-and-replay loop against any
// terminal run (verified against the running stack): the server's own
// producer stops itself once the run is done, failed or cancelled
// (services/runs/logs.py's _TERMINAL_STATUSES check) and simply closes
// the response -- which EventSource's spec treats as a transient drop
// to retry, not a stream that is finished for good. Left alone, the
// browser reconnects a few seconds later, the server replays the whole
// log from the top again, closes again, and the cycle repeats forever.
// Closing the connection ourselves in `onerror` once the caller already
// knows the run is terminal is what actually stops it.
export function useRunLogStream(runId: number, source: LogSource, runIsFinished: boolean): UseRunLogStreamResult {
  const [lines, setLines] = useState<LogLine[]>([])
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const nextLineId = useRef(0)

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/runs/${runId}/logs?source=${source}`)

    eventSource.onopen = () => {
      // Every new connection's own producer starts its tail over from
      // the top (services/runs/logs.py's own module docstring) -- so a
      // genuine reconnect (a dropped network mid-stream, on a run still
      // going) would otherwise duplicate every line already shown
      // rather than replacing them.
      setLines([])
      nextLineId.current = 0
      setConnectionError(null)
    }

    eventSource.onmessage = (event: MessageEvent<string>) => {
      const id = nextLineId.current
      nextLineId.current += 1
      const text = stripAnsiCodes(event.data)
      setLines((previous) => {
        const next = [...previous, { id, text }]
        return next.length > MAX_BUFFERED_LINES
          ? next.slice(next.length - MAX_BUFFERED_LINES)
          : next
      })
    }

    eventSource.onerror = () => {
      if (runIsFinished) {
        eventSource.close()
        setConnectionError(null)
        return
      }
      // CLOSED means the browser gave up for good (e.g. the initial
      // response wasn't a 200 text/event-stream -- a 404 for a run that
      // doesn't exist) and will not retry on its own. Any other state
      // is a transient drop mid-stream that EventSource already retries
      // itself with its own backoff -- the `runIsFinished` branch above
      // is about a *terminal run's* stream closing on purpose, not
      // about closing a live run's connection on a drop.
      setConnectionError(
        eventSource.readyState === EventSource.CLOSED
          ? 'Log stream closed -- the run may no longer exist.'
          : 'Reconnecting to log stream…',
      )
    }

    return () => {
      eventSource.close()
    }
  }, [runId, source, runIsFinished])

  return { lines, connectionError }
}

// "Waiting for log output…" reads wrong once a run is already finished
// with nothing recorded (e.g. cancelled before the harness ever
// started, like a run cancelled while still waiting on a cold start) --
// there is nothing left to wait for.
export function emptyLogMessage(runIsFinished: boolean): string {
  return runIsFinished ? 'No log output was recorded for this run.' : 'Waiting for log output\u2026'
}
