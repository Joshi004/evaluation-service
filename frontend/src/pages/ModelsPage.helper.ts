// Non-DOM logic for ModelsPage.tsx (docs/UI_REDESIGN_PLAN.md §8.11):
// the URL contract (every default here is a constant, the same
// useUrlState-plus-a-resolver split RunsPage.helper.ts already uses),
// filtering the loaded checkpoint list, and building each model's own
// overview -- its evaluated/not-evaluated results, its lineage and its
// run counts -- from data the page already has loaded, with no
// per-model request.
import type { CheckpointListItem, RunListItem, StandardSummary } from '../api/client'
import type { LeaderboardBoard } from '../utils/buildLeaderboard'
import { NO_FAMILY_KEY } from '../utils/familyGroups'
import { familyKey } from '../utils/familyKey'
import { resolveModelLineage, type ModelLineage } from '../utils/modelLineage'
import { buildModelResults, type ModelEvaluatedResult, type ModelResults } from '../utils/modelResults'
import { countRunsByStatus, type RunsStatusCounts } from '../utils/runStatus'
import { readEnumParam, readListParam, readStringParam, type UrlParamValue } from '../utils/useUrlState'

const VIEW_VALUES = ['cards', 'table'] as const
export type ModelsViewMode = (typeof VIEW_VALUES)[number]

const WEIGHTS_FILTER_VALUES = ['all', 'available', 'unavailable', 'incomplete', 'unknown'] as const
export type ModelsWeightsFilter = (typeof WEIGHTS_FILTER_VALUES)[number]

// The index signature only satisfies useUrlState's own
// `T extends Record<string, UrlParamValue>` constraint (mirrors
// RunsUrlParams' own docstring in RunsPage.helper.ts) -- every real
// call site still reads and writes through the named fields.
export interface ModelsUrlParams {
  [key: string]: UrlParamValue
  q: string
  family: string[]
  weights: ModelsWeightsFilter
  view: ModelsViewMode
}

export const MODELS_URL_DEFAULTS: ModelsUrlParams = {
  q: '',
  family: [],
  weights: 'all',
  view: 'cards',
}

export interface ResolvedModelsView {
  q: string
  familyFilter: string[]
  weights: ModelsWeightsFilter
  view: ModelsViewMode
}

export function resolveModelsView(params: URLSearchParams): ResolvedModelsView {
  return {
    q: readStringParam(params, 'q') ?? '',
    familyFilter: readListParam(params, 'family'),
    weights: readEnumParam(params, 'weights', WEIGHTS_FILTER_VALUES, 'all'),
    view: readEnumParam(params, 'view', VIEW_VALUES, 'cards'),
  }
}

export function filterCheckpoints(checkpoints: CheckpointListItem[], view: ResolvedModelsView): CheckpointListItem[] {
  const trimmedQuery = view.q.trim().toLowerCase()
  return checkpoints.filter((checkpoint) => {
    if (view.weights !== 'all' && checkpoint.availability_status !== view.weights) {
      return false
    }
    if (view.familyFilter.length > 0) {
      const key = checkpoint.family === null ? NO_FAMILY_KEY : familyKey(checkpoint.family)
      if (!view.familyFilter.includes(key)) {
        return false
      }
    }
    if (trimmedQuery === '') {
      return true
    }
    return (
      checkpoint.name.toLowerCase().includes(trimmedQuery) ||
      (checkpoint.family?.toLowerCase().includes(trimmedQuery) ?? false)
    )
  })
}

export interface ModelOverview {
  checkpoint: CheckpointListItem
  results: ModelResults
  // The most recent evaluated result's finished_at, or null for a
  // model with no done result on any setup yet -- ModelCard/ModelsTable
  // both show this as "Last evaluated <RelativeTime>" or "Not evaluated
  // yet".
  lastEvaluatedAt: string | null
  lineage: ModelLineage
  runCounts: RunsStatusCounts
}

function latestFinishedAt(evaluated: ModelEvaluatedResult[]): string | null {
  if (evaluated.length === 0) {
    return null
  }
  return evaluated.reduce(
    (latest, entry) => (new Date(entry.cell.finishedAt) > new Date(latest) ? entry.cell.finishedAt : latest),
    evaluated[0].cell.finishedAt,
  )
}

export function buildModelOverview(
  checkpoint: CheckpointListItem,
  board: LeaderboardBoard,
  standards: StandardSummary[],
  allCheckpoints: CheckpointListItem[],
  allRuns: RunListItem[],
): ModelOverview {
  const results = buildModelResults(board, standards, checkpoint.id)
  return {
    checkpoint,
    results,
    lastEvaluatedAt: latestFinishedAt(results.evaluated),
    lineage: resolveModelLineage(checkpoint, allCheckpoints),
    runCounts: countRunsByStatus(allRuns.filter((run) => run.checkpoint_id === checkpoint.id)),
  }
}
