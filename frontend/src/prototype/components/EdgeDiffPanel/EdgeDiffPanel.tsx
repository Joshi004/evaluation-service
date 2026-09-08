import type { LineageEdge } from '../../data/types'

/**
 * One benchmark's row in the diff — fully pre-formatted by the page (via
 * computeTwoWayDelta/deltaTone/deltaToneClass from PrototypeCompare.helper.ts)
 * so this panel and the Compare page can never disagree about whether a
 * difference is real.
 */
export interface EdgeDiffBenchmarkRow {
  benchmarkId: string
  benchmarkName: string
  deltaLabel: string
  toneClass: string
  noiseLabel: string | null
}

interface EdgeDiffPanelProps {
  edge: LineageEdge
  fromCheckpointName: string
  toCheckpointName: string
  rows: EdgeDiffBenchmarkRow[]
  onClose: () => void
}

// The Model History page's "click an edge, see the diff" panel
// (EVAL_SERVICE_PLAN.md Section 14: "Edges are annotated with what
// changed... Click an edge, see the diff."). Sits in the same side-panel
// slot as CheckpointInspector — only one of the two is open at a time.
export function EdgeDiffPanel({ edge, fromCheckpointName, toCheckpointName, rows, onClose }: EdgeDiffPanelProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-100">{edge.operation}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {fromCheckpointName} → {toCheckpointName}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-300">
          ✕
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-300">{edge.detail}</p>

      {edge.trainingRunUrl && (
        <a href={edge.trainingRunUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-sky-400 hover:underline">
          View training run (W&B) →
        </a>
      )}

      <div className="mt-4">
        <h4 className="text-xs font-medium text-slate-400">What this step changed</h4>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Neither checkpoint has a standard, published run to compare yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {rows.map((row) => (
              <li key={row.benchmarkId} className="flex items-center justify-between gap-3">
                <span className="text-slate-300">{row.benchmarkName}</span>
                <span className={`text-sm font-medium ${row.toneClass}`}>
                  {row.deltaLabel}
                  {row.noiseLabel && <span className="ml-1 text-xs font-normal text-slate-500">{row.noiseLabel}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
