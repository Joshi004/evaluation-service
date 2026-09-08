// A deliberate feature, not a placeholder to feel bad about: when a
// board genuinely has no results yet, this is what "honest" looks like
// (see docs/IMPLEMENTATION_PHASES.md, Trap T5) -- never a spinner that
// never resolves, and never a fabricated row.

interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  )
}
