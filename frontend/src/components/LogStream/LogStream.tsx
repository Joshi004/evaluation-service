import { useEffect, useRef } from 'react'
import { cn } from '../../utils/cn'
import { emptyLogMessage, useRunLogStream, type LogSource } from './LogStream.helper'

interface LogStreamProps {
  runId: number
  source: LogSource
  // Whether this run has reached a terminal status -- lets the
  // underlying stream stop itself instead of endlessly reconnecting
  // against a log that will never grow again (LogStream.helper.ts's own
  // docstring), and picks the right empty-state wording.
  runIsFinished: boolean
  // Caps the panel to its last N lines and drops the internal scroll,
  // for a compact inline tail (the Overview tab's own failure panel) --
  // omitted for the full scrolling view (the Logs tab).
  maxLines?: number
  // Auto-scrolls to the newest line as it arrives. On by default; the
  // Logs tab's own Follow toggle turns it off so scrolling up to read
  // older lines doesn't keep snapping back to the bottom.
  follow?: boolean
  // Wraps long lines instead of letting them scroll horizontally. On by
  // default; the Logs tab's own Wrap toggle turns it off for output
  // that reads better unwrapped (e.g. a wide table the harness printed).
  wrap?: boolean
  className?: string
}

// Renders a scrolling, auto-following log panel (or, with `maxLines`, a
// short non-scrolling tail). All the streaming and buffering lives in
// useRunLogStream (LogStream.helper.ts), which owns the EventSource and
// closes it on unmount (T3) -- this component only renders what that
// hook already has in the shape it needs.
//
// Callers switching `source` (e.g. the Logs tab's harness/model-server
// toggle) must render this with `key={source}` (or a key including
// runId too, wherever runId itself can change under a mounted parent).
// Without that key, React keeps reusing the same component instance
// and useRunLogStream's buffered lines from the old source would still
// be showing, mixed in with the new one's.
export function LogStream({
  runId,
  source,
  runIsFinished,
  maxLines,
  follow = true,
  wrap = true,
  className,
}: LogStreamProps) {
  const { lines, connectionError } = useRunLogStream(runId, source, runIsFinished)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isCompact = maxLines !== undefined
  const visibleLines = isCompact ? lines.slice(-maxLines) : lines

  useEffect(() => {
    const container = scrollRef.current
    // The compact tail is short enough to read in full without
    // scrolling itself into view on every new line -- only the Logs
    // tab's own full panel auto-follows, and only while its own Follow
    // toggle is on.
    if (container && !isCompact && follow) {
      container.scrollTop = container.scrollHeight
    }
  }, [visibleLines, isCompact, follow])

  return (
    <div className={className}>
      {connectionError && <p className="mb-2 text-xs text-warning">{connectionError}</p>}
      <div
        ref={scrollRef}
        className={cn(
          'overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs text-muted-foreground',
          isCompact ? 'max-h-56' : 'h-80',
        )}
      >
        {visibleLines.length === 0 && !connectionError && (
          <p className="text-subtle-foreground">{emptyLogMessage(runIsFinished)}</p>
        )}
        {visibleLines.map((line) => (
          <div key={line.id} className={wrap ? 'whitespace-pre-wrap' : 'whitespace-pre'}>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  )
}
