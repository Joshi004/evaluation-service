import { Fragment } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Link } from 'react-router'
import type { RunDetail } from '../../api/client'
import { useRunsById } from '../../api/queries/runs'
import { benchmarkVersion } from '../../utils/benchmarkDisplayName'
import type { BenchmarkColumn, SetupResult } from '../../utils/buildLeaderboard'
import { formatScoreDelta } from '../../utils/formatScore'
import { TERM_HINTS } from '../../utils/labels'
import { paths } from '../../utils/paths'
import { samplingProfileDisplayName } from '../../utils/samplingProfileDisplayName'
import { Badge } from '../Badge/Badge'
import { ScoreValue } from '../ScoreValue/ScoreValue'
import { Skeleton } from '../Skeleton/Skeleton'
import { TermLabel } from '../TermLabel/TermLabel'
import { Tooltip } from '../Tooltip/Tooltip'
import { buildOtherSetupDiff } from './LeaderboardOtherSetups.helper'

interface LeaderboardOtherSetupsProps {
  column: BenchmarkColumn
  // The result on screen -- every row below is compared against it.
  shown: SetupResult
  otherSetups: SetupResult[]
}

// The hover card's "Other setups" section: this model's results on the
// benchmark under every setup other than the one on screen, each with
// its score and how far that sits from the score shown. Hovering or
// focusing a row says exactly what changed. Rendered inside HoverCard's
// content, which Radix only mounts while the card is open -- so the run
// details these diffs need are fetched on hover, not for every cell on
// the page, and land in the same cache the run report itself reads.
export function LeaderboardOtherSetups({ column, shown, otherSetups }: LeaderboardOtherSetupsProps) {
  const runQueries = useRunsById([shown.cell.evalRunId, ...otherSetups.map((other) => other.cell.evalRunId)])
  const [shownRunQuery, ...otherRunQueries] = runQueries

  return (
    <section className="space-y-1.5 border-t border-border pt-3">
      <h3 className="text-xs font-medium text-muted-foreground">
        <TermLabel hint={TERM_HINTS.otherSetups}>Other setups</TermLabel>
      </h3>
      <ul className="space-y-0.5">
        {otherSetups.map((other, index) => (
          <li key={other.setup.comparisonHash}>
            <Tooltip
              className="max-w-sm"
              content={<SetupDiffContent shownRunQuery={shownRunQuery} otherRunQuery={otherRunQueries[index]} />}
            >
              <Link
                to={paths.run(other.cell.evalRunId)}
                className="-mx-1 flex items-center justify-between gap-3 rounded-md px-1 py-0.5 text-xs hover:bg-muted"
              >
                <span className="flex items-center gap-1.5">
                  <Badge tone="neutral">
                    {samplingProfileDisplayName(other.setup.samplingProfileLabel, other.setup.samplingProfileHash)}
                  </Badge>
                  {column.hasMultipleStandardVersions && (
                    <Badge tone="neutral">{benchmarkVersion(other.setup.standardLabel) ?? 'custom'}</Badge>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <ScoreValue value={other.cell.value} />
                  <span className="tabular-nums text-muted-foreground">
                    {formatScoreDelta(other.cell.value - shown.cell.value)}
                  </span>
                </span>
              </Link>
            </Tooltip>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface SetupDiffContentProps {
  shownRunQuery: UseQueryResult<RunDetail>
  otherRunQuery: UseQueryResult<RunDetail>
}

function SetupDiffContent({ shownRunQuery, otherRunQuery }: SetupDiffContentProps) {
  if (shownRunQuery.isError || otherRunQuery.isError) {
    return <p>Couldn&rsquo;t load this run&rsquo;s setup. Open the run to see it.</p>
  }

  if (!shownRunQuery.data || !otherRunQuery.data) {
    return (
      <div className="w-48 space-y-1.5" aria-busy="true">
        <span className="sr-only">Loading what changed</span>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    )
  }

  const diff = buildOtherSetupDiff(shownRunQuery.data, otherRunQuery.data)

  if (diff.summaries.length === 0 && diff.fieldRows.length === 0) {
    return <p>No differences found.</p>
  }

  return (
    <div className="space-y-2">
      <p className="font-medium text-foreground">Differs from the score shown</p>
      {diff.summaries.length > 0 && (
        <ul className="space-y-0.5 text-muted-foreground">
          {diff.summaries.map((summary) => (
            <li key={summary}>{summary}</li>
          ))}
        </ul>
      )}
      {diff.fieldRows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {diff.fieldRows.map((row) => (
            <Fragment key={row.label}>
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="tabular-nums text-foreground">
                {row.values[0]} &rarr; {row.values[1]}
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}
