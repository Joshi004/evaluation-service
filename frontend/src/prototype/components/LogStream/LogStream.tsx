import { useEffect, useRef } from 'react'

interface LogStreamProps {
  lines: string[]
}

// A simulated `tail -f` of one run's job output. Lines are append-only
// (see useRunSimulation.ts) and never reordered or removed except on a
// full reset, which replaces the whole array — so indexing by position
// for the key is safe here.
export function LogStream({ lines }: LogStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [lines])

  return (
    <div
      ref={containerRef}
      className="h-56 overflow-y-auto rounded-lg border border-slate-800 bg-black p-3 font-mono text-xs text-slate-300"
    >
      {lines.length === 0 ? (
        <p className="text-slate-600">Waiting for the first log line...</p>
      ) : (
        lines.map((line, index) => (
          <p key={index} className="whitespace-pre-wrap">
            {line}
          </p>
        ))
      )}
    </div>
  )
}
