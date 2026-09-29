import { AlertTriangle, CircleCheck, X } from 'lucide-react'
import { Link } from 'react-router'
import { useStandards } from '../../api/queries/standards'
import { benchmarkDisplayName } from '../../utils/benchmarkDisplayName'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { MAX_COMPARE_RUNS, setupMatch, type PinnedRun, type SetupMatch } from '../../utils/compareTray'
import { paths } from '../../utils/paths'
import { useCompareTray } from '../../utils/useCompareTray'
import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import { IconButton } from '../IconButton/IconButton'
import { ModelName } from '../ModelName/ModelName'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { SetupChip } from '../SetupChip/SetupChip'
import { Tooltip } from '../Tooltip/Tooltip'

// One pinned run's chip: identity, model, setup and score, plus its own
// remove control. Not exported -- only CompareTray renders one, the
// same "small local subcomponent" pattern Sidebar.tsx uses for its own
// nav row.
function PinnedRunChip({ run, onRemove }: { run: PinnedRun; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-sm">
      <Link to={paths.run(run.runId)} className="font-medium text-primary hover:underline">
        #{run.runId}
      </Link>
      <ModelName name={run.modelName} />
      <SetupChip samplingProfileLabel={run.samplingProfileLabel} samplingProfileHash={run.samplingProfileHash} />
      <ScoreValue value={run.scoreFraction} />
      <IconButton variant="ghost" size="sm" aria-label={`Remove run #${run.runId} from compare`} onClick={onRemove}>
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </IconButton>
    </li>
  )
}

// "Same setup" / "Setups differ" (§8.5 item 3): the tray only enforces
// one *benchmark* (findPinRefusal), so two pinned runs of that
// benchmark can still carry different comparison hashes -- e.g. IFEval
// under `greedy` vs `qwen3_5_think`. This is what tells someone their
// pinned pair is not yet the like-for-like kind before they click
// Compare. Not exported -- only rendered here, once at least two runs
// are pinned.
function SetupMatchBadge({ match }: { match: SetupMatch }) {
  if (match === 'same') {
    return (
      <Tooltip content="Every pinned run shares one setup -- their scores are directly comparable.">
        <span tabIndex={0}>
          <Badge tone="success" className="gap-1">
            <CircleCheck className="h-3 w-3" aria-hidden="true" />
            Same setup
          </Badge>
        </span>
      </Tooltip>
    )
  }
  return (
    <Tooltip content="Pinned runs use different sampling profiles -- Compare will show what changed.">
      <span tabIndex={0}>
        <Badge tone="warning" className="gap-1">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          Setups differ
        </Badge>
      </span>
    </Tooltip>
  )
}

// §8.5: a cross-app basket of runs to compare, docked at the bottom of
// the content area (mounted once in AppShell, a sibling of <main>, so
// it can never cover page content). Hidden entirely when nothing is
// pinned -- there is no empty-tray affordance to design for, since
// AddToCompareButton is how a tray ever gets its first run.
export function CompareTray() {
  const { pinnedRuns, unpinRun, clearTray } = useCompareTray()
  const standards = useStandards()

  if (pinnedRuns.length === 0) {
    return null
  }

  const benchmarkName = benchmarkDisplayName(pinnedRuns[0].benchmark, standards.data ?? [])
  const match = setupMatch(pinnedRuns)
  const canCompare = pinnedRuns.length >= MAX_COMPARE_RUNS

  return (
    <section
      aria-label="Compare tray"
      className="flex shrink-0 flex-wrap items-center gap-4 border-t border-border bg-card px-4 py-3"
    >
      <p className="text-sm font-medium text-foreground">
        Compare <span aria-hidden="true">{'\u00b7'}</span> {benchmarkName}
      </p>

      <ul className="flex flex-wrap items-center gap-2">
        {pinnedRuns.map((run) => (
          <PinnedRunChip key={run.runId} run={run} onRemove={() => unpinRun(run.runId)} />
        ))}
      </ul>

      {match !== null && <SetupMatchBadge match={match} />}
      {pinnedRuns.length === 1 && (
        <p className="text-xs text-muted-foreground">Pin another {benchmarkName} run to compare.</p>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={clearTray}>
          Clear
        </Button>
        {canCompare ? (
          <Link
            to={paths.compareLeftRight(pinnedRuns[0].runId, pinnedRuns[1].runId)}
            className={buttonClassName('primary', BUTTON_LABEL_SIZE.sm)}
          >
            Compare
          </Link>
        ) : (
          <Button variant="primary" size="sm" disabled>
            Compare
          </Button>
        )}
      </div>
    </section>
  )
}
