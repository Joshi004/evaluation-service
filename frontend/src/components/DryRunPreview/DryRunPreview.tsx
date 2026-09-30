import type { RunPreview } from '../../api/client'
import { ErrorState } from '../ErrorState/ErrorState'
import { Skeleton } from '../Skeleton/Skeleton'
import { groupFindingsByCode, type CreatedItem, type GroupedFinding } from './DryRunPreview.helper'

interface DryRunPreviewProps {
  preview: RunPreview | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  // Already computed by the caller (buildCreatedItems) from this same
  // `preview` plus the wizard's own resolved labels -- kept as a prop
  // rather than computed in here so this component stays a pure
  // renderer of whatever the caller already has in hand.
  createdItems: CreatedItem[]
}

interface FindingGroupItemProps {
  finding: GroupedFinding
  textClassName: string
}

// One collapsed finding: its message once, plus which pairs it applies
// to -- inline when there's only one, behind a <details> toggle when a
// grid-wide finding would otherwise repeat itself for every pair it hit.
function FindingGroupItem({ finding, textClassName }: FindingGroupItemProps) {
  return (
    <li className={`text-sm ${textClassName}`}>
      {finding.message}
      {finding.pairLabels.length === 1 ? (
        <span className="ml-1 text-muted-foreground">({finding.pairLabels[0]})</span>
      ) : (
        <details className="mt-0.5">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {finding.pairLabels.length} pairs affected
          </summary>
          <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
            {finding.pairLabels.map((pairLabel) => (
              <li key={pairLabel}>{pairLabel}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

// Everything the Review step needs to show before anything POSTs: which
// findings block or merely warn and why, and a compact list of what a
// real submit would actually insert (a new benchmark protocol,
// sampling profile and/or serving profile) -- all of it comes straight
// from POST /runs/preview (backend/app/services/runs/preview.py), so
// this page and the Benchmarks/Profiles pages can never disagree about
// what a value does. The per-pair "resolved standard/sampling/serving"
// cards the original Submit page showed here (every merge layer, not
// just the answer) moved to the Settings step's own setup-alignment
// line, which is where "will this line up with the leaderboard?" now
// lives (docs/UI_REDESIGN_PLAN.md §8.10).
export function DryRunPreview({ preview, isLoading, isError, error, onRetry, createdItems }: DryRunPreviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (isError) {
    return <ErrorState message="Could not check this selection." details={String(error)} onRetry={onRetry} />
  }

  if (!preview) {
    return null
  }

  const groupedErrors = groupFindingsByCode(preview.pairs, 'errors')
  const groupedWarnings = groupFindingsByCode(preview.pairs, 'warnings')
  const isAllClear = groupedErrors.length === 0 && groupedWarnings.length === 0 && createdItems.length === 0

  return (
    <div className="space-y-4">
      {groupedErrors.length > 0 && (
        <div className="rounded-md border border-danger/30 bg-danger-soft p-3">
          <p className="text-sm font-medium text-danger">
            {groupedErrors.length} problem{groupedErrors.length === 1 ? '' : 's'} block running this evaluation
          </p>
          <ul className="mt-2 space-y-1.5">
            {groupedErrors.map((finding) => (
              <FindingGroupItem
                key={`${finding.code}-${finding.field}-${finding.message}`}
                finding={finding}
                textClassName="text-danger"
              />
            ))}
          </ul>
        </div>
      )}

      {groupedWarnings.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning-soft p-3">
          <p className="text-sm font-medium text-warning">
            {groupedWarnings.length} warning{groupedWarnings.length === 1 ? '' : 's'} -- recorded, does not block
            running
          </p>
          <ul className="mt-2 space-y-1.5">
            {groupedWarnings.map((finding) => (
              <FindingGroupItem
                key={`${finding.code}-${finding.field}-${finding.message}`}
                finding={finding}
                textClassName="text-warning"
              />
            ))}
          </ul>
        </div>
      )}

      {createdItems.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground">What will be created</h3>
          <ul className="mt-2 space-y-1">
            {createdItems.map((item) => (
              <li key={item.key} className="text-sm text-foreground">
                {item.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isAllClear && (
        <p className="text-sm text-muted-foreground">
          No problems found. Every model, benchmark, sampling and serving profile already exists as shown.
        </p>
      )}
    </div>
  )
}
