import { useEffect, useRef } from 'react'
import { useRunLogStream, type LogSource } from './LogStream.helper'

interface LogStreamProps {
  runId: number
  source: LogSource
}

// Renders a scrolling, auto-following log panel. All the streaming and
// buffering lives in useRunLogStream (LogStream.helper.ts), which owns
// the EventSource and closes it on unmount (T3) -- this component only
// renders what that hook already has in the shape it needs.
//
// Callers switching `source` (e.g. RunDetailPage's harness/cluster
// toggle) must render this with `key={source}` (or a key including
// runId too, wherever runId itself can change under a mounted parent).
// Without that key, React keeps reusing the same component instance
// and useRunLogStream's buffered lines from the old source would still
// be showing, mixed in with the new one's.
export function LogStream({ runId, source }: LogStreamProps) {
  const { lines, connectionError } = useRunLogStream(runId, source)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [lines])

  return (
    <div>
      {connectionError && <p className="mb-2 text-xs text-amber-400">{connectionError}</p>}
      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300"
      >
        {lines.length === 0 && !connectionError && (
          <p className="text-slate-600">Waiting for log output…</p>
        )}
        {lines.map((line) => (
          <div key={line.id} className="whitespace-pre-wrap">
            {line.text}
          </div>
        ))}
      </div>
    </div>
  )
}
