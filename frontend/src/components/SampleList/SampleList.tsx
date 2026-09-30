import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import type { DiagnosticsSample } from '../../api/client'
import { cn } from '../../utils/cn'
import { paths } from '../../utils/paths'
import { previewText } from '../../utils/previewText'
import { tagHint, tagLabel } from '../../utils/tagLabel'
import { Badge } from '../Badge/Badge'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { Tooltip } from '../Tooltip/Tooltip'
import { outcomeBadge, primaryScoreText, sampleRowLinkId } from './SampleList.helper'

interface SampleListProps {
  runId: number
  samples: DiagnosticsSample[]
  primaryMetricName: string
  primaryMetricDisplayName: string
  showSubsetColumn: boolean
  selectedSampleKey: string | null
  // Hides the Output and score columns once the panel is open
  // (docs/UI_REDESIGN_PLAN.md §8.7, item 4) -- there is no room for
  // them once the panel takes half the width, and the panel itself
  // already shows both in full.
  compact: boolean
}

// Layer 4's table (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 4):
// renders whichever page of already-filtered samples the caller
// fetched. Every row deep-links to /runs/:runId/samples/:sampleKey,
// keeping the current filter query string, so a colleague following the
// link lands on the same filtered view this row came from, not just the
// bare sample.
export function SampleList({
  runId,
  samples,
  primaryMetricName,
  primaryMetricDisplayName,
  showSubsetColumn,
  selectedSampleKey,
  compact,
}: SampleListProps) {
  const location = useLocation()
  const navigate = useNavigate()

  // The whole row is clickable (§8.7's own acceptance), but the Key
  // cell keeps a real <Link> too -- for keyboard focus, screen readers,
  // and right-click/open-in-new-tab. A click that started on that link
  // already navigated on its own; skip the row's own navigate so it
  // isn't pushed to history twice.
  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, sampleKey: string): void {
    if ((event.target as HTMLElement).closest('a')) {
      return
    }
    navigate({ pathname: paths.runSample(runId, sampleKey), search: location.search })
  }

  return (
    <Table>
      <thead>
        <tr>
          <TableHeaderCell>Key</TableHeaderCell>
          {showSubsetColumn && <TableHeaderCell>Subset</TableHeaderCell>}
          <TableHeaderCell>Outcome</TableHeaderCell>
          <TableHeaderCell>Tags</TableHeaderCell>
          <TableHeaderCell>Input</TableHeaderCell>
          {!compact && <TableHeaderCell>Output</TableHeaderCell>}
          {!compact && <TableHeaderCell className="text-right">{primaryMetricDisplayName}</TableHeaderCell>}
        </tr>
      </thead>
      <tbody>
        {samples.map((sample) => {
          const badge = outcomeBadge(sample.passed)
          const isSelected = sample.sample_key === selectedSampleKey
          return (
            <tr
              key={sample.sample_key}
              onClick={(event) => handleRowClick(event, sample.sample_key)}
              className={cn('cursor-pointer hover:bg-muted', isSelected && 'bg-primary-soft')}
            >
              <TableCell>
                <Link
                  id={sampleRowLinkId(sample.sample_key)}
                  to={{ pathname: paths.runSample(runId, sample.sample_key), search: location.search }}
                  className="font-mono text-primary hover:underline"
                >
                  {sample.sample_key}
                </Link>
              </TableCell>
              {showSubsetColumn && <TableCell>{sample.subset}</TableCell>}
              <TableCell>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {sample.tags.map((tag) => {
                    const hint = tagHint(tag)
                    if (hint === null) {
                      return (
                        <Badge key={tag} tone="neutral">
                          {tagLabel(tag)}
                        </Badge>
                      )
                    }
                    return (
                      <Tooltip key={tag} content={hint}>
                        <span tabIndex={0}>
                          <Badge tone="neutral">{tagLabel(tag)}</Badge>
                        </span>
                      </Tooltip>
                    )
                  })}
                </div>
              </TableCell>
              <TableCell className="max-w-[24rem] truncate" title={sample.input_preview}>
                {previewText(sample.input_preview)}
              </TableCell>
              {!compact && (
                <TableCell className="max-w-[24rem] truncate" title={sample.output_preview}>
                  {previewText(sample.output_preview)}
                </TableCell>
              )}
              {!compact && (
                <TableCell className="text-right font-mono tabular-nums">
                  {primaryScoreText(sample.scores, primaryMetricName)}
                </TableCell>
              )}
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
