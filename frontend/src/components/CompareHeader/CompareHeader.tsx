import { MoreHorizontal } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import type { RunDetail } from '../../api/client'
import { cn } from '../../utils/cn'
import { seriesBgClassName } from '../../utils/compareSeriesColor'
import { MAX_COMPARE_RUNS } from '../../utils/compareTray'
import { paths } from '../../utils/paths'
import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import { CopyLinkButton } from '../CopyLinkButton/CopyLinkButton'
import { IconButton } from '../IconButton/IconButton'
import { Menu } from '../Menu/Menu'
import { ModelName } from '../ModelName/ModelName'
import { PageHeader } from '../PageHeader/PageHeader'
import { SetupChip } from '../SetupChip/SetupChip'
import { Tooltip } from '../Tooltip/Tooltip'
import { compareRunsDescription } from './CompareHeader.helper'

interface CompareHeaderProps {
  benchmarkDisplayName: string
  // Baseline first -- every other Compare section reads this same
  // order for its own row/column order and series colour.
  runs: RunDetail[]
  canAddRun: boolean
  onMakeBaseline: (runId: number) => void
  onRemove: (runId: number) => void
  onAddRun: () => void
}

// The compare page's own identity strip (docs/UI_REDESIGN_PLAN.md
// §8.8): one chip per run, each carrying the series colour every other
// Compare section reuses for that same run, plus the "Make
// baseline"/"Remove" actions that rewrite the page's own ?runs= --
// CompareSetupCheck, CompareScoreMatrix and CompareFlippedSamples just
// re-render against whatever order that produces.
export function CompareHeader({
  benchmarkDisplayName,
  runs,
  canAddRun,
  onMakeBaseline,
  onRemove,
  onAddRun,
}: CompareHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="space-y-3">
      <PageHeader
        title="Compare runs"
        description={compareRunsDescription(benchmarkDisplayName, runs.length)}
        actions={
          <>
            <Tooltip content={canAddRun ? 'Add another run' : `Compare limit reached (${MAX_COMPARE_RUNS} runs)`}>
              <span tabIndex={0}>
                <Button variant="secondary" size="sm" disabled={!canAddRun} onClick={onAddRun}>
                  Add run
                </Button>
              </span>
            </Tooltip>
            <CopyLinkButton />
          </>
        }
      />
      <ul className="flex flex-wrap items-center gap-2">
        {runs.map((run, index) => (
          <li
            key={run.id}
            className="flex items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1.5 text-sm"
          >
            <span className={cn('h-2 w-2 rounded-full', seriesBgClassName(index))} aria-hidden="true" />
            <Link to={paths.run(run.id)} className="font-medium text-primary hover:underline">
              #{run.id}
            </Link>
            <ModelName name={run.checkpoint_name} />
            <SetupChip
              samplingProfileLabel={run.sampling_profile_label}
              samplingProfileHash={run.sampling_profile_hash}
            />
            {index === 0 && <Badge tone="info">Baseline</Badge>}
            <Menu
              trigger={
                <IconButton aria-label={`Run #${run.id} actions`} size="sm" variant="ghost">
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              }
              items={[
                ...(index === 0 ? [] : [{ label: 'Make baseline', onSelect: () => onMakeBaseline(run.id) }]),
                { label: 'Open run', onSelect: () => navigate(paths.run(run.id)) },
                { label: 'Remove from comparison', onSelect: () => onRemove(run.id), destructive: true },
              ]}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
