// Non-DOM logic for NewEvaluationPage.tsx: turning the three prefill
// params (Phase 10, docs/UI_REDESIGN_PLAN.md §8.10 and Appendix A --
// `models`, `benchmarks`, `from`) into the wizard's own starting
// selection and drafts. Read once, at mount (see NewEvaluationPage.tsx's
// own comment on `prefillKey`) -- nothing here reacts to a later change
// of these same params.
import type { CheckpointListItem, RunDetail, StandardSummary } from '../api/client'
import {
  EMPTY_SUBMIT_OVERRIDE_DRAFTS,
  withSamplingProfileChoice,
  withServingProfileChoice,
  type SubmitOverrideDrafts,
} from '../components/SubmitOverrides/SubmitOverrides.helper'

export interface PrefillResult {
  checkpointIds: number[]
  standardIds: number[]
  drafts: SubmitOverrideDrafts
  // One sentence per id or protocol that couldn't be carried over --
  // shown as an inline notice rather than blocking the page, since a
  // partial prefill (one axis restored, one left for the submitter to
  // pick) is still strictly better than refusing to open at all.
  notices: string[]
}

// React's own `key` prop (NewEvaluationPage.tsx) is what makes a new
// prefill start the wizard fresh -- this is only the string that key
// changes on, not a computation of anything by itself. `step` is
// deliberately excluded: moving between steps must never look like a
// new prefill.
export function buildPrefillKey(modelsParam: string | null, benchmarksParam: string | null, fromParam: string | null): string {
  return `${modelsParam ?? ''}|${benchmarksParam ?? ''}|${fromParam ?? ''}`
}

export function parseFromParam(fromParam: string | null): number | null {
  if (fromParam === null) {
    return null
  }
  const parsed = Number.parseInt(fromParam, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseIdListParam(param: string | null): number[] {
  if (param === null || param === '') {
    return []
  }
  return param
    .split(',')
    .map((raw) => Number.parseInt(raw, 10))
    .filter((id) => Number.isFinite(id))
}

function resolveModelsAndBenchmarksPrefill(
  modelsParam: string | null,
  benchmarksParam: string | null,
  checkpointsById: Map<number, CheckpointListItem>,
  standardsById: Map<number, StandardSummary>,
): PrefillResult {
  const notices: string[] = []

  const checkpointIds = parseIdListParam(modelsParam).filter((id) => {
    const exists = checkpointsById.has(id)
    if (!exists) {
      notices.push(`Model #${id} from the link no longer exists.`)
    }
    return exists
  })

  const standardIds = parseIdListParam(benchmarksParam).filter((id) => {
    const exists = standardsById.has(id)
    if (!exists) {
      notices.push(`Benchmark #${id} from the link no longer exists.`)
    }
    return exists
  })

  return { checkpointIds, standardIds, drafts: EMPTY_SUBMIT_OVERRIDE_DRAFTS, notices }
}

// Re-run's own prefill (Phase 7's RunFailurePanel/RunReportHeader and
// Phase 9's RunsTableRow all link here with `?from=<runId>`): the same
// model and benchmark, plus whichever sampling/serving profile that run
// actually used -- but only recorded as an explicit choice when it
// differs from the checkpoint's own *current* registered default, so a
// re-run of a run that already matched the default doesn't show a
// pointless "customized" state the moment the wizard opens.
function resolveFromRunPrefill(
  fromRun: RunDetail,
  checkpointsById: Map<number, CheckpointListItem>,
  standardsById: Map<number, StandardSummary>,
): PrefillResult {
  const notices: string[] = []

  const checkpoint = checkpointsById.get(fromRun.checkpoint_id)
  if (!checkpoint) {
    notices.push(`Model #${fromRun.checkpoint_id} from run #${fromRun.id} no longer exists.`)
  }

  // GET /standards only returns reviewed (labelled) standards -- a run
  // whose own standard was an ad-hoc override (label === null) has
  // nothing in `standardsById` to resolve back to, the same reason
  // CheckpointSamplingCard's own picker never offers an ad-hoc *base*
  // profile as an option either.
  const standard = fromRun.standard_label !== null ? standardsById.get(fromRun.standard_id) : undefined
  if (!standard) {
    notices.push(
      `Run #${fromRun.id} used a custom benchmark protocol that can't be prefilled -- choose a benchmark to continue.`,
    )
  }

  let drafts = EMPTY_SUBMIT_OVERRIDE_DRAFTS
  if (checkpoint) {
    if (fromRun.sampling.id !== checkpoint.default_sampling_profile_id) {
      drafts = withSamplingProfileChoice(drafts, checkpoint.id, fromRun.sampling.id)
    }
    if (fromRun.serving.id !== checkpoint.default_serving_profile_id) {
      drafts = withServingProfileChoice(drafts, checkpoint.id, fromRun.serving.id)
    }
  }

  return {
    checkpointIds: checkpoint ? [checkpoint.id] : [],
    standardIds: standard ? [standard.id] : [],
    drafts,
    notices,
  }
}

// `fromRun` is `undefined` while the run hasn't loaded yet (the caller
// doesn't call this until then), `null` when there is no `from` param
// at all or it failed to load -- `from` wins over `models`/`benchmarks`
// per this phase's own prefill precedence (docs/UI_REDESIGN_PLAN.md
// §8.10 item 2).
export function resolvePrefill(
  modelsParam: string | null,
  benchmarksParam: string | null,
  fromRun: RunDetail | null,
  checkpointsById: Map<number, CheckpointListItem>,
  standardsById: Map<number, StandardSummary>,
): PrefillResult {
  if (fromRun !== null) {
    return resolveFromRunPrefill(fromRun, checkpointsById, standardsById)
  }
  return resolveModelsAndBenchmarksPrefill(modelsParam, benchmarksParam, checkpointsById, standardsById)
}
