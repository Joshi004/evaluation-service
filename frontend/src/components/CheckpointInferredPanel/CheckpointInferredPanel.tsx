import { useQuery } from '@tanstack/react-query'
import { apiFetch, type CheckpointDetail } from '../../api/client'
import { InspectionSummary } from '../InspectionSummary/InspectionSummary'
import { inferredFieldsFromCheckpoint } from '../InspectionSummary/InspectionSummary.helper'

interface CheckpointInferredPanelProps {
  checkpointId: number
}

// The checkpoints page's expandable row (Phase 8): reuses
// InspectionSummary from Phase 7 to show what the server inferred at
// registration, but for an already-registered checkpoint rather than a
// pending candidate. Its own component, not inline in the page's row
// map, because it owns a useQuery -- a hook inside `.map()` would trip
// react/rules-of-hooks (R-T26). Mounting only on expand is what makes
// the GET /checkpoints/{id} fetch lazy.
export function CheckpointInferredPanel({ checkpointId }: CheckpointInferredPanelProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['checkpoint', checkpointId],
    queryFn: () => apiFetch<CheckpointDetail>(`/checkpoints/${checkpointId}`),
  })

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading inferred metadata…</p>
  }

  if (isError) {
    return <p className="text-sm text-red-400">Could not load checkpoint: {String(error)}</p>
  }

  if (!data) {
    return null
  }

  return (
    <InspectionSummary
      fields={inferredFieldsFromCheckpoint(data.inferred)}
      // problems is an inspect-time concept (CheckpointInspection.problems)
      // with no stored counterpart on an already-registered checkpoint --
      // whatever inspection could not read at registration simply stayed
      // null among the fields above, so there is nothing to list here.
      problems={[]}
      sourceConfig={data.inferred.source_config}
    />
  )
}
