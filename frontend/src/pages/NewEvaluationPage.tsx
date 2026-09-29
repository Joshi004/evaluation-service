import { Link, useSearchParams } from 'react-router'
import { useCheckpoints } from '../api/queries/checkpoints'
import { useRun } from '../api/queries/runs'
import { useSamplingProfiles } from '../api/queries/samplingProfiles'
import { useServingProfiles } from '../api/queries/servingProfiles'
import { useStandards } from '../api/queries/standards'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { NewEvaluationWizard } from '../components/NewEvaluationWizard/NewEvaluationWizard'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { indexById } from '../utils/indexById'
import { paths } from '../utils/paths'
import { buildPrefillKey, parseFromParam, resolvePrefill } from './NewEvaluationPage.helper'

// New evaluation (Phase 10, docs/UI_REDESIGN_PLAN.md §8.10): resolves
// the page-level concerns -- loading the four catalogs, resolving
// `?models=&benchmarks=` or `?from=` into a starting selection, and the
// full-page skeleton/error/empty states -- then hands a plain starting
// selection to NewEvaluationWizard, which owns everything from there.
//
// Prefill params are read once, effectively: `prefillKey` (built from
// `models`/`benchmarks`/`from` alone, never `step`) is passed as the
// wizard's own React `key`, so a *different* prefill link (a second
// "Run it" click while this page happens to already be open) mounts a
// fresh wizard instead of merging into whatever selection is already
// there, while moving between steps -- which only ever changes `step`
// -- never remounts it.
export function NewEvaluationPage() {
  const [searchParams] = useSearchParams()
  const modelsParam = searchParams.get('models')
  const benchmarksParam = searchParams.get('benchmarks')
  const fromParam = searchParams.get('from')
  const fromRunId = parseFromParam(fromParam)

  const checkpointsQuery = useCheckpoints()
  const standardsQuery = useStandards()
  const samplingProfilesQuery = useSamplingProfiles()
  const servingProfilesQuery = useServingProfiles()
  // `fromRunId ?? NaN`: useRun's own enabled check (Number.isFinite)
  // is what keeps this from ever calling GET /runs/:id when there is
  // no `from` param at all.
  const fromRunQuery = useRun(fromRunId ?? NaN)

  const isLoadingCatalogs =
    checkpointsQuery.isLoading ||
    standardsQuery.isLoading ||
    samplingProfilesQuery.isLoading ||
    servingProfilesQuery.isLoading
  const isLoadingFromRun = fromRunId !== null && fromRunQuery.isLoading

  if (isLoadingCatalogs || isLoadingFromRun) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const hasCatalogsError =
    checkpointsQuery.isError || standardsQuery.isError || samplingProfilesQuery.isError || servingProfilesQuery.isError

  if (hasCatalogsError) {
    return (
      <ErrorState
        message="Could not load models, benchmarks or profiles."
        details={String(
          checkpointsQuery.error ?? standardsQuery.error ?? samplingProfilesQuery.error ?? servingProfilesQuery.error,
        )}
        onRetry={() => {
          checkpointsQuery.refetch()
          standardsQuery.refetch()
          samplingProfilesQuery.refetch()
          servingProfilesQuery.refetch()
        }}
      />
    )
  }

  const checkpoints = checkpointsQuery.data ?? []
  if (checkpoints.length === 0) {
    return (
      <EmptyState
        title="No models registered yet"
        description="Register a model, then come back here to run it against a benchmark."
        actions={
          <Link to={paths.modelRegister()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
            Register a model
          </Link>
        }
      />
    )
  }

  const standards = standardsQuery.data ?? []
  const samplingProfiles = samplingProfilesQuery.data ?? []
  const servingProfiles = servingProfilesQuery.data ?? []

  // A failed from-run fetch degrades to "nothing to prefill from"
  // rather than blocking the whole page -- the submitter can still
  // pick a model and benchmark by hand (docs/UI_REDESIGN_PLAN.md
  // §8.10's own "skip what can't be prefilled" rule).
  const fromRunFailed = fromRunId !== null && fromRunQuery.isError
  const prefill = resolvePrefill(
    modelsParam,
    benchmarksParam,
    fromRunFailed ? null : (fromRunQuery.data ?? null),
    indexById(checkpoints),
    indexById(standards),
  )

  return (
    <div className="space-y-4">
      {fromRunFailed && (
        <p className="text-sm text-warning">Could not load run #{fromRunId} to prefill from -- starting blank.</p>
      )}
      {prefill.notices.map((notice) => (
        <p key={notice} className="text-sm text-warning">
          {notice}
        </p>
      ))}
      <NewEvaluationWizard
        key={buildPrefillKey(modelsParam, benchmarksParam, fromParam)}
        checkpoints={checkpoints}
        standards={standards}
        samplingProfiles={samplingProfiles}
        servingProfiles={servingProfiles}
        initialCheckpointIds={prefill.checkpointIds}
        initialStandardIds={prefill.standardIds}
        initialDrafts={prefill.drafts}
      />
    </div>
  )
}
