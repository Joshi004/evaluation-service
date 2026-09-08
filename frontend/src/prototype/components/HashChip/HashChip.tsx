interface HashChipProps {
  label: string
  hash: string
}

// A short, monospace, labelled hash — profile_hash or recipe_hash. Real
// runs group and compare by this value (EVAL_SERVICE_PLAN.md Section 5),
// so it's shown as a distinct, copyable-looking chip rather than buried
// in prose.
export function HashChip({ label, hash }: HashChipProps) {
  return (
    <span
      title={hash}
      className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-400"
    >
      <span className="text-slate-500">{label}</span>
      {hash}
    </span>
  )
}
