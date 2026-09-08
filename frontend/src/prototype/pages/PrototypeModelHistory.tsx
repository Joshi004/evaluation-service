import { useMemo, useState } from 'react'
import type { Benchmark, Checkpoint, EvalRun, LineageEdge, Modality, Team } from '../data/types'
import { benchmarks, getBenchmark } from '../data/benchmarks'
import { findCheckpoint } from '../data/checkpoints'
import { getEdgesWithin } from '../data/lineage'
import { usePrototypeStore } from '../state/usePrototypeStore'
import { CheckpointInspector } from '../components/CheckpointInspector/CheckpointInspector'
import type { MetricUnit } from '../components/ConfidenceInterval/ConfidenceInterval.helper'
import { EdgeDiffPanel } from '../components/EdgeDiffPanel/EdgeDiffPanel'
import { LineageGraph } from '../components/LineageGraph/LineageGraph'
import { MergeDialog } from '../components/MergeDialog/MergeDialog'
import { checkMergeCompatibility } from '../components/MergeDialog/MergeDialog.helper'
import { MODALITY_OPTIONS, TEAM_OPTIONS, pickDisplayRun } from './PrototypeLeaderboard.helper'
import {
  buildEdgeDiffRows,
  buildHistoryLayout,
  filterCheckpointsForHistory,
  getBenchmarksWithData,
  getDeadEndCheckpointIds,
  getOrphanRootCheckpointIds,
  type ModelHistoryFilters,
} from './PrototypeModelHistory.helper'

const GRAPH_HEIGHT = 640
const MAX_MERGE_SELECTION = 2

export function PrototypeModelHistory() {
  const { runs, checkpoints, lineageEdges, mergeCheckpoints } = usePrototypeStore()

  const [filters, setFilters] = useState<ModelHistoryFilters>({ team: 'all', modality: 'all', publishedOnly: false })
  const [benchmarkId, setBenchmarkId] = useState<string | null>(null)
  const [inspectedCheckpointId, setInspectedCheckpointId] = useState<string | null>(null)
  const [inspectedEdge, setInspectedEdge] = useState<LineageEdge | null>(null)
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([])
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false)
  const [justMergedCheckpointId, setJustMergedCheckpointId] = useState<string | null>(null)

  const positions = useMemo(() => buildHistoryLayout(checkpoints, lineageEdges), [checkpoints, lineageEdges])
  const visibleCheckpoints = useMemo(() => filterCheckpointsForHistory(checkpoints, filters), [checkpoints, filters])
  const visibleCheckpointIds = useMemo(() => visibleCheckpoints.map((checkpoint) => checkpoint.id), [visibleCheckpoints])
  const visibleEdges = useMemo(() => getEdgesWithin(lineageEdges, visibleCheckpointIds), [lineageEdges, visibleCheckpointIds])

  const benchmarkOptions = useMemo(
    () => getBenchmarksWithData(visibleCheckpointIds, benchmarks, runs),
    [visibleCheckpointIds, runs],
  )
  const activeBenchmarkId = benchmarkId ?? benchmarkOptions[0]?.id ?? benchmarks[0].id
  const activeBenchmark = getBenchmark(activeBenchmarkId)
  const activeUnit: MetricUnit = activeBenchmark.metrics.find((metric) => metric.key === activeBenchmark.primaryMetricKey)?.unit ?? '%'

  const deadEndCheckpointIds = useMemo(() => getDeadEndCheckpointIds(lineageEdges), [lineageEdges])
  const orphanRootCheckpointIds = useMemo(() => getOrphanRootCheckpointIds(checkpoints), [checkpoints])

  // Derived from the *visible* set, not looked up unconditionally — a
  // checkpoint that gets filtered out while its panel is open should
  // just make the panel disappear, with no extra effect needed to clear
  // the id that's now pointing at something off-screen.
  const inspectedCheckpoint = inspectedCheckpointId
    ? visibleCheckpoints.find((checkpoint) => checkpoint.id === inspectedCheckpointId) ?? null
    : null

  const mergeSelectedCheckpoints = useMemo(
    () => mergeSelectedIds.map((id) => findCheckpoint(checkpoints, id)).filter((c): c is Checkpoint => c !== null),
    [mergeSelectedIds, checkpoints],
  )
  const [mergeCandidateA, mergeCandidateB] = mergeSelectedCheckpoints
  const mergeCompatibility =
    mergeCandidateA && mergeCandidateB ? checkMergeCompatibility(mergeCandidateA, mergeCandidateB) : null

  const inspectedCheckpointRuns = useMemo(
    () => (inspectedCheckpoint ? runs.filter((run) => run.checkpointId === inspectedCheckpoint.id) : []),
    [inspectedCheckpoint, runs],
  )
  const inspectedBenchmarkResults = useMemo(() => {
    if (!inspectedCheckpoint) return []
    return benchmarks
      .map((benchmark) => {
        const run = pickDisplayRun(inspectedCheckpoint.id, benchmark.id, runs, true)
        return run ? { benchmark, run } : null
      })
      .filter((row): row is { benchmark: Benchmark; run: EvalRun } => row !== null)
  }, [inspectedCheckpoint, runs])
  const inspectedMergedFromCheckpoints = useMemo(() => {
    if (!inspectedCheckpoint?.mergedFromIds) return []
    return inspectedCheckpoint.mergedFromIds.map((id) => findCheckpoint(checkpoints, id)).filter((c): c is Checkpoint => c !== null)
  }, [inspectedCheckpoint, checkpoints])

  const edgeDiffRows = useMemo(
    () => (inspectedEdge ? buildEdgeDiffRows(inspectedEdge, benchmarks, runs) : []),
    [inspectedEdge, runs],
  )

  function handleNodeClick(checkpointId: string) {
    setInspectedEdge(null)
    setInspectedCheckpointId(checkpointId)
  }

  function handleEdgeClick(edge: LineageEdge) {
    setInspectedCheckpointId(null)
    setInspectedEdge(edge)
  }

  function toggleMergeSelection(checkpointId: string) {
    setMergeSelectedIds((previous) => {
      if (previous.includes(checkpointId)) return previous.filter((id) => id !== checkpointId)
      if (previous.length >= MAX_MERGE_SELECTION) return previous
      return [...previous, checkpointId]
    })
  }

  function handleMergeCreated(checkpoint: Checkpoint, edges: LineageEdge[]) {
    mergeCheckpoints(checkpoint, edges)
    setJustMergedCheckpointId(checkpoint.id)
  }

  function handleMergeDialogClose() {
    setIsMergeDialogOpen(false)
    setMergeSelectedIds([])
    if (justMergedCheckpointId) {
      setInspectedEdge(null)
      setInspectedCheckpointId(justMergedCheckpointId)
      setJustMergedCheckpointId(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Model History</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Every checkpoint the portfolio has ever produced, in one graph — three families in their own lane, bases on
        the left, each SFT/RL/quantization/distillation step an edge to the right of it. Click a node for its
        benchmarks, click an edge for what that step changed, or select two nodes to merge them.
      </p>
      <p className="mt-3 max-w-2xl rounded border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-200">
        A finding from building this page: <code className="text-sky-300">docs/DATA_MODEL.md</code>'s checkpoint
        table has one <code className="text-sky-300">parent_checkpoint_id</code> column, so a real merged
        checkpoint's second parent would have nowhere to go there either — this graph's two converging edges are the
        only place both parents are represented.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <select
          value={filters.team}
          onChange={(event) => setFilters((prev) => ({ ...prev, team: event.target.value as Team | 'all' }))}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
        >
          <option value="all">All teams</option>
          {TEAM_OPTIONS.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>

        <select
          value={filters.modality}
          onChange={(event) => setFilters((prev) => ({ ...prev, modality: event.target.value as Modality | 'all' }))}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
        >
          <option value="all">All modalities</option>
          {MODALITY_OPTIONS.map((modality) => (
            <option key={modality} value={modality}>
              {modality}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={filters.publishedOnly}
            onChange={(event) => setFilters((prev) => ({ ...prev, publishedOnly: event.target.checked }))}
            className="accent-sky-500"
          />
          Published only
        </label>

        {benchmarkOptions.length > 0 && (
          <select
            value={activeBenchmarkId}
            onChange={(event) => setBenchmarkId(event.target.value)}
            className="ml-auto rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
          >
            {benchmarkOptions.map((benchmark) => (
              <option key={benchmark.id} value={benchmark.id}>
                Label by {benchmark.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          {visibleCheckpoints.length === 0 ? (
            <div
              style={{ height: GRAPH_HEIGHT }}
              className="flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-500"
            >
              No checkpoints match these filters.
            </div>
          ) : (
            <LineageGraph
              key={visibleCheckpointIds.join(',')}
              checkpoints={visibleCheckpoints}
              positions={positions}
              edges={visibleEdges}
              runs={runs}
              benchmarkId={activeBenchmarkId}
              primaryMetricKey={activeBenchmark.primaryMetricKey}
              unit={activeUnit}
              focusedCheckpointId={inspectedCheckpointId ?? ''}
              height={GRAPH_HEIGHT}
              selectedCheckpointIds={mergeSelectedIds}
              deadEndCheckpointIds={deadEndCheckpointIds}
              orphanRootCheckpointIds={orphanRootCheckpointIds}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
            />
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
            <LegendSwatch className="border border-sky-400 bg-sky-500/10" label="Inspecting" />
            <LegendSwatch className="border border-slate-600 ring-2 ring-violet-400" label="Selected for merge" />
            <LegendSwatch className="border border-dashed border-amber-500/50 bg-slate-900" label="Abandoned branch" />
            <LegendSwatch className="border border-slate-700 bg-amber-500/20" label="Untracked base" textClass="text-amber-400" />
            <LegendSwatch className="border border-slate-700 bg-emerald-500/20" label="Published" textClass="text-emerald-400" />
          </div>
        </div>

        <div className="space-y-4">
          {mergeSelectedCheckpoints.length > 0 && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-violet-300">Merge selection</h3>
                <button
                  type="button"
                  onClick={() => setMergeSelectedIds([])}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                {mergeSelectedCheckpoints.map((checkpoint) => (
                  <li key={checkpoint.id} className="flex items-center justify-between gap-2">
                    <span>{checkpoint.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleMergeSelection(checkpoint.id)}
                      aria-label={`Remove ${checkpoint.name} from merge selection`}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>

              {mergeSelectedCheckpoints.length < MAX_MERGE_SELECTION ? (
                <p className="mt-2 text-xs text-slate-500">Select one more checkpoint on the graph to merge.</p>
              ) : mergeCompatibility && !mergeCompatibility.isCompatible ? (
                <p className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {mergeCompatibility.reason}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsMergeDialogOpen(true)}
                  className="mt-3 w-full rounded-md bg-violet-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-violet-400"
                >
                  Merge these two →
                </button>
              )}
            </div>
          )}

          {inspectedCheckpoint && (
            <div>
              <CheckpointInspector
                checkpoint={inspectedCheckpoint}
                mergedFromCheckpoints={inspectedMergedFromCheckpoints}
                totalRunCount={inspectedCheckpointRuns.length}
                exploratoryRunCount={inspectedCheckpointRuns.filter((run) => !run.isStandard).length}
                benchmarkResults={inspectedBenchmarkResults}
                onClose={() => setInspectedCheckpointId(null)}
              />
              <button
                type="button"
                onClick={() => toggleMergeSelection(inspectedCheckpoint.id)}
                disabled={
                  !mergeSelectedIds.includes(inspectedCheckpoint.id) && mergeSelectedIds.length >= MAX_MERGE_SELECTION
                }
                title={
                  !mergeSelectedIds.includes(inspectedCheckpoint.id) && mergeSelectedIds.length >= MAX_MERGE_SELECTION
                    ? 'Merge selection already has two checkpoints — remove one first.'
                    : undefined
                }
                className={
                  mergeSelectedIds.includes(inspectedCheckpoint.id)
                    ? 'mt-2 w-full rounded-md border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-sm font-medium text-violet-300'
                    : 'mt-2 w-full rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40'
                }
              >
                {mergeSelectedIds.includes(inspectedCheckpoint.id) ? '✓ Selected for merge — click to remove' : 'Select for merge'}
              </button>
            </div>
          )}

          {inspectedEdge && (
            <EdgeDiffPanel
              edge={inspectedEdge}
              fromCheckpointName={findCheckpoint(checkpoints, inspectedEdge.fromCheckpointId)?.name ?? inspectedEdge.fromCheckpointId}
              toCheckpointName={findCheckpoint(checkpoints, inspectedEdge.toCheckpointId)?.name ?? inspectedEdge.toCheckpointId}
              rows={edgeDiffRows}
              onClose={() => setInspectedEdge(null)}
            />
          )}

          {!inspectedCheckpoint && !inspectedEdge && mergeSelectedCheckpoints.length === 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
              Click a checkpoint to see its benchmarks, or an edge to see what that training step changed.
            </div>
          )}
        </div>
      </div>

      {isMergeDialogOpen && mergeCandidateA && mergeCandidateB && (
        <MergeDialog
          checkpointA={mergeCandidateA}
          checkpointB={mergeCandidateB}
          benchmarks={benchmarks}
          runs={runs}
          onMerge={handleMergeCreated}
          onClose={handleMergeDialogClose}
        />
      )}
    </div>
  )
}

function LegendSwatch({ className, label, textClass }: { className: string; label: string; textClass?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${textClass ?? ''}`}>
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  )
}
