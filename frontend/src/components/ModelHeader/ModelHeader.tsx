import { Link } from 'react-router'
import type { CheckpointDetail, CheckpointListItem, StandardSummary } from '../../api/client'
import type { LeaderboardBoard } from '../../utils/buildLeaderboard'
import { groupCheckpointsByFamily, type FamilyGroup } from '../../utils/familyGroups'
import { familyKey } from '../../utils/familyKey'
import { buildModelResults } from '../../utils/modelResults'
import { paths } from '../../utils/paths'
import { AvailabilityBadge } from '../AvailabilityBadge/AvailabilityBadge'
import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { CompareWithModelButton } from '../CompareWithModelButton/CompareWithModelButton'
import { CopyLinkButton } from '../CopyLinkButton/CopyLinkButton'
import { ModelName } from '../ModelName/ModelName'
import { PageHeader } from '../PageHeader/PageHeader'
import { RelativeTime } from '../RelativeTime/RelativeTime'
import { Tooltip } from '../Tooltip/Tooltip'

interface ModelHeaderProps {
  checkpoint: CheckpointDetail
  allCheckpoints: CheckpointListItem[]
  standards: StandardSummary[]
  board: LeaderboardBoard
}

// The chip shows the family group's own chosen spelling, not this
// checkpoint's raw `family` string -- one family, one spelling,
// everywhere, so this page can never show a different spelling than
// the Models list' own section header for the same group.
function resolveFamilyGroup(checkpoint: CheckpointDetail, allCheckpoints: CheckpointListItem[]): FamilyGroup | null {
  if (checkpoint.family === null) {
    return null
  }
  const key = familyKey(checkpoint.family)
  return groupCheckpointsByFamily(allCheckpoints).find((group) => group.key === key) ?? null
}

// The model page's own header: identity (name, family, weights,
// registration), then the actions every tab needs regardless of which
// one is open -- ModelDetailPage renders this once, above the
// <Outlet>, the same split RunReportHeader already uses for the run
// report.
export function ModelHeader({ checkpoint, allCheckpoints, standards, board }: ModelHeaderProps) {
  const notEvaluated = buildModelResults(board, standards, checkpoint.id).notEvaluated
  const isUnavailable = checkpoint.availability_status === 'unavailable'
  const familyGroup = resolveFamilyGroup(checkpoint, allCheckpoints)

  return (
    <PageHeader
      breadcrumb={
        <Link to={paths.models()} className="hover:text-foreground hover:underline">
          Models
        </Link>
      }
      title={<ModelName name={checkpoint.name} maxLength={60} copyable />}
      description={
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {familyGroup !== null && (
              <Link
                to={paths.models({ family: familyGroup.key })}
                className="rounded-full transition-opacity hover:opacity-80"
              >
                <Badge tone="neutral">{familyGroup.label}</Badge>
              </Link>
            )}
            <AvailabilityBadge status={checkpoint.availability_status} />
            {checkpoint.availability_checked_at !== null && (
              <span>
                Checked <RelativeTime timestamp={checkpoint.availability_checked_at} />
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Registered by {checkpoint.registered_by ?? '\u2014'}
            {' \u00b7 '}
            <RelativeTime timestamp={checkpoint.created_at} />
          </p>
          {isUnavailable && (
            <p className="text-xs text-danger">
              Registration is intact — only the weights are missing.
              {checkpoint.availability_detail && ` ${checkpoint.availability_detail}`}
            </p>
          )}
        </div>
      }
      actions={
        <>
          <Link
            to={paths.newEvaluation({ models: [checkpoint.id] })}
            className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}
          >
            Evaluate
          </Link>
          {notEvaluated.length > 0 ? (
            <Link
              to={paths.newEvaluation({
                models: [checkpoint.id],
                benchmarks: notEvaluated.map((entry) => entry.standardId),
              })}
              className={buttonClassName('secondary', BUTTON_LABEL_SIZE.md)}
            >
              Evaluate on missing benchmarks
            </Link>
          ) : (
            <Tooltip content="Every catalog benchmark already has a result for this model.">
              <Button
                variant="secondary"
                aria-disabled
                className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
              >
                Evaluate on missing benchmarks
              </Button>
            </Tooltip>
          )}
          <CompareWithModelButton checkpoint={checkpoint} allCheckpoints={allCheckpoints} board={board} size="md" />
          <CopyLinkButton />
        </>
      }
    />
  )
}
