import { useState } from 'react'
import { Link } from 'react-router'
import { useCheckpoints } from '../api/queries/checkpoints'
import { useLeaderboard } from '../api/queries/leaderboard'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { MetricCell } from '../components/MetricCell/MetricCell'
import {
  buildComparePath,
  buildLeaderboardGrid,
  MAX_COMPARE_SELECTION,
  toggleRunSelection,
} from './LeaderboardPage.helper'

export function LeaderboardPage() {
  const leaderboard = useLeaderboard()

  // Fetched only to resolve checkpoint_id -> display name: the
  // leaderboard query is used verbatim from the spec and returns ids,
  // not names.
  const checkpoints = useCheckpoints()

  const grid =
    leaderboard.data && checkpoints.data ? buildLeaderboardGrid(leaderboard.data, checkpoints.data) : null

  // Phase 9 (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md): which two run
  // ids are picked for compare mode. Transient, not URL state -- the
  // comparison itself is what gets a shareable URL, once "Compare
  // these runs" below is clicked.
  const [selectedRunIds, setSelectedRunIds] = useState<number[]>([])

  function handleToggleRunSelection(evalRunId: number) {
    setSelectedRunIds((current) => toggleRunSelection(current, evalRunId))
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Every checkpoint's most recent finished result per comparison hash. Each column is one comparison
        hash -- same standard AND same resolved sampling profile -- so two runs only ever share a column
        if they measured the same thing; the sampling profile beneath each standard's name is what tells
        two columns for the same benchmark apart.
      </p>

      <div className="mt-8">
        {(leaderboard.isLoading || checkpoints.isLoading) && (
          <p className="text-sm text-slate-500">Loading leaderboard…</p>
        )}

        {(leaderboard.isError || checkpoints.isError) && (
          <p className="text-sm text-red-400">
            Could not load the leaderboard: {String(leaderboard.error ?? checkpoints.error)}
          </p>
        )}

        {grid && grid.rows.length === 0 && <EmptyState message="No results yet" />}

        {grid && grid.rows.length > 0 && selectedRunIds.length > 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
            <span className="text-slate-300">
              Selected {selectedRunIds.length} of {MAX_COMPARE_SELECTION} runs to compare
            </span>
            {selectedRunIds.length === MAX_COMPARE_SELECTION ? (
              <Link
                to={buildComparePath(selectedRunIds)}
                className="rounded border border-blue-500/30 px-2 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/10"
              >
                Compare these two runs
              </Link>
            ) : (
              <span className="text-xs text-slate-500">Pick one more cell to compare.</span>
            )}
            <button
              type="button"
              onClick={() => setSelectedRunIds([])}
              className="ml-auto text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Clear
            </button>
          </div>
        )}

        {grid && grid.rows.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                  Checkpoint
                </th>
                {grid.columns.map((column) => (
                  <th
                    key={column.comparisonHash}
                    className="border-b border-slate-800 p-2 text-right font-medium text-slate-400"
                  >
                    <div>{column.standardLabel}</div>
                    {/* S-D36: the comparison hash is what stops two
                        differently-sampled runs sharing a cell; this
                        label is what stops a reader thinking they
                        should. */}
                    <div className="text-xs font-normal text-slate-500">{column.samplingProfileLabel}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.checkpointId}>
                  <td className="border-b border-slate-800/50 p-2 text-slate-200">{row.checkpointName}</td>
                  {grid.columns.map((column) => {
                    const cell = row.cellsByComparisonHash[column.comparisonHash]
                    return cell === undefined ? (
                      <td
                        key={column.comparisonHash}
                        className="border-b border-slate-800/50 p-2 text-right text-slate-600"
                      >
                        —
                      </td>
                    ) : (
                      <MetricCell
                        key={column.comparisonHash}
                        value={cell.value}
                        comparisonHash={column.comparisonHash}
                        evalRunId={cell.evalRunId}
                        selected={selectedRunIds.includes(cell.evalRunId)}
                        selectionFull={selectedRunIds.length >= MAX_COMPARE_SELECTION}
                        onToggleSelected={() => handleToggleRunSelection(cell.evalRunId)}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
