import { useState } from 'react'
import type { RunListItem } from '../../api/client'
import { TERM_HINTS } from '../../utils/labels'
import { compareRunsNewestFirst, type RunsViewMode } from '../../pages/RunsPage.helper'
import { RunsBatchHeaderRow } from '../RunsBatchHeaderRow/RunsBatchHeaderRow'
import { RunsTableRow } from '../RunsTableRow/RunsTableRow'
import { TableHeaderCell } from '../Table/Table'
import { TermLabel } from '../TermLabel/TermLabel'
import { buildRunsSections } from './RunsTable.helper'

interface RunsTableProps {
  visibleRuns: RunListItem[]
  allRuns: RunListItem[]
  viewMode: RunsViewMode
  now: Date
}

// Run, Model & benchmark, Result, Time, Submitted by, Actions.
const GROUPED_COLUMN_COUNT = 6
// The above, plus a Batch column.
const FLAT_COLUMN_COUNT = 7

const STICKY_HEADER_CLASSES = 'sticky top-0 z-10'

// Grouped by batch by default, or a flat list with its own Batch
// column -- both share one sticky-header scroll container and the same
// row rendering (RunsTableRow), so nothing about a single run's own
// row differs between the two lenses. Takes only the runs and the view
// mode so the model Runs tab can reuse this unchanged for one
// checkpoint's own runs.
export function RunsTable({ visibleRuns, allRuns, viewMode, now }: RunsTableProps) {
  // Ids present here are *collapsed*; every other batch is expanded --
  // batches start expanded with no action needed to reach that state.
  // Local to this component, not the URL: a colleague following a
  // shared link doesn't need someone else's collapse choices restored.
  const [collapsedBatchIds, setCollapsedBatchIds] = useState<Set<number>>(new Set())

  function toggleBatch(runGroupId: number): void {
    setCollapsedBatchIds((current) => {
      const next = new Set(current)
      if (next.has(runGroupId)) {
        next.delete(runGroupId)
      } else {
        next.add(runGroupId)
      }
      return next
    })
  }

  const sections = buildRunsSections(visibleRuns, allRuns)
  const columnCount = viewMode === 'flat' ? FLAT_COLUMN_COUNT : GROUPED_COLUMN_COUNT
  const disambiguatorByGroupId = new Map(sections.map((section) => [section.batch.runGroupId, section.batch.disambiguator]))

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <TableHeaderCell className={STICKY_HEADER_CLASSES}>Run</TableHeaderCell>
            {viewMode === 'flat' && (
              <TableHeaderCell className={STICKY_HEADER_CLASSES}>
                <TermLabel hint={TERM_HINTS.batch}>Batch</TermLabel>
              </TableHeaderCell>
            )}
            <TableHeaderCell className={STICKY_HEADER_CLASSES}>Model &amp; benchmark</TableHeaderCell>
            <TableHeaderCell className={STICKY_HEADER_CLASSES}>Result</TableHeaderCell>
            <TableHeaderCell className={STICKY_HEADER_CLASSES}>Time</TableHeaderCell>
            <TableHeaderCell className={STICKY_HEADER_CLASSES}>Submitted by</TableHeaderCell>
            <TableHeaderCell className={STICKY_HEADER_CLASSES} />
          </tr>
        </thead>

        {viewMode === 'flat' ? (
          <tbody>
            {[...visibleRuns].sort(compareRunsNewestFirst).map((run) => (
              <RunsTableRow
                key={run.id}
                run={run}
                now={now}
                showBatchColumn
                batchDisambiguator={disambiguatorByGroupId.get(run.run_group_id) ?? null}
              />
            ))}
          </tbody>
        ) : (
          sections.map((section) => {
            const expanded = !collapsedBatchIds.has(section.batch.runGroupId)
            return (
              <tbody key={section.batch.runGroupId}>
                <RunsBatchHeaderRow
                  batch={section.batch}
                  columnCount={columnCount}
                  expanded={expanded}
                  onToggle={() => toggleBatch(section.batch.runGroupId)}
                />
                {expanded &&
                  section.visibleRuns.map((run) => (
                    <RunsTableRow key={run.id} run={run} now={now} showBatchColumn={false} />
                  ))}
              </tbody>
            )
          })
        )}
      </table>
    </div>
  )
}
