import { Link } from 'react-router'
import type { RunDetail } from '../../api/client'
import { useLeaderboard } from '../../api/queries/leaderboard'
import { useRuns } from '../../api/queries/runs'
import { TERM_HINTS } from '../../utils/labels'
import { paths } from '../../utils/paths'
import { Skeleton } from '../Skeleton/Skeleton'
import { TermLabel } from '../TermLabel/TermLabel'
import {
  buildMovementText,
  rankStandingText,
  resolvePreviousRun,
  resolveRankStanding,
} from './RunStandingLines.helper'

interface RunStandingLinesProps {
  run: RunDetail
}

// The two context lines a verdict needs to read as more than a bare
// number (§3 rule 4, "uncertainty is part of the number", extended here
// to context as well): how this run ranks among its peers on this setup
// right now, and how it moved against its own model's previous result
// on the same setup. Each degrades independently -- a run with no peers
// still gets a movement line, and vice versa (docs/UI_REDESIGN_PLAN.md
// §8.7's own acceptance criterion: "degrade gracefully when there is no
// peer or previous run").
export function RunStandingLines({ run }: RunStandingLinesProps) {
  return (
    <div className="space-y-0.5 text-sm text-muted-foreground">
      <RankLine run={run} />
      <MovementLine run={run} />
    </div>
  )
}

// Not exported -- only RunStandingLines renders one, kept local because
// nothing outside this file needs the rank line on its own.
function RankLine({ run }: { run: RunDetail }) {
  const leaderboard = useLeaderboard()
  const primaryMetric = run.standard.metrics.find((metric) => metric.is_primary)
  const higherIsBetter = primaryMetric?.higher_is_better ?? true

  if (leaderboard.isLoading) {
    return <Skeleton className="h-4 w-40" />
  }
  if (leaderboard.isError) {
    return <p>Rank unavailable right now</p>
  }

  const standing = resolveRankStanding(run, leaderboard.data ?? [], higherIsBetter)
  if (standing.kind === 'superseded') {
    return (
      <p>
        <TermLabel hint={TERM_HINTS.superseded}>Superseded</TermLabel> by{' '}
        <Link to={paths.run(standing.byRunId)} className="text-primary hover:underline">
          run #{standing.byRunId}
        </Link>
      </p>
    )
  }
  const text = rankStandingText(standing)
  return text === null ? null : <p>{text}</p>
}

// Not exported, for the same reason as RankLine above.
function MovementLine({ run }: { run: RunDetail }) {
  const sameSetupRuns = useRuns({
    checkpoint_id: run.checkpoint_id,
    comparison_hash: run.comparison_hash,
    status: 'done',
  })

  if (sameSetupRuns.isLoading) {
    return <Skeleton className="h-4 w-56" />
  }
  if (sameSetupRuns.isError) {
    return <p>Movement unavailable right now</p>
  }

  const previousRun = resolvePreviousRun(run, sameSetupRuns.data ?? [])
  if (previousRun === null) {
    return <p>First run of this model on this setup</p>
  }

  const primaryMetric = run.performance?.metrics.find((metric) => metric.is_primary)
  const movement = buildMovementText(run, previousRun, primaryMetric?.display ?? null)
  return movement === null ? null : <p>{movement.text}</p>
}
