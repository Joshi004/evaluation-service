import { useQuery } from '@tanstack/react-query'
import { apiFetch, type CheckpointListItem } from '../api/client'
import { EmptyState } from '../components/EmptyState/EmptyState'

// `family` is nullish for a checkpoint nobody's grouped yet -- bucket it
// under "Ungrouped" rather than dropping it from the page.
function groupByFamily(checkpoints: CheckpointListItem[]): Map<string, CheckpointListItem[]> {
  const groups = new Map<string, CheckpointListItem[]>()
  for (const checkpoint of checkpoints) {
    const family = checkpoint.family ?? 'Ungrouped'
    const group = groups.get(family)
    if (group) {
      group.push(checkpoint)
    } else {
      groups.set(family, [checkpoint])
    }
  }
  return groups
}

function parentName(checkpoint: CheckpointListItem, allCheckpoints: CheckpointListItem[]): string {
  if (checkpoint.parent_checkpoint_id === null) {
    return '—'
  }
  const parent = allCheckpoints.find((candidate) => candidate.id === checkpoint.parent_checkpoint_id)
  return parent?.name ?? `#${checkpoint.parent_checkpoint_id}`
}

export function CheckpointDetailPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['checkpoints'],
    queryFn: () => apiFetch<CheckpointListItem[]>('/checkpoints'),
  })

  return (
    <div>
      <h1 className="text-2xl font-semibold">Checkpoints</h1>
      <p className="mt-2 max-w-2xl text-slate-400">Every registered checkpoint, grouped by family.</p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading checkpoints…</p>}

      {isError && <p className="mt-6 text-sm text-red-400">Could not load checkpoints: {String(error)}</p>}

      {data && data.length === 0 && (
        <div className="mt-6">
          <EmptyState message="No checkpoints registered yet" />
        </div>
      )}

      {data && data.length > 0 && (
        <div className="mt-6 space-y-8">
          {[...groupByFamily(data)].map(([family, familyCheckpoints]) => (
            <section key={family}>
              <h2 className="text-sm font-medium text-slate-400">{family}</h2>
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                      Name
                    </th>
                    <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                      Path
                    </th>
                    <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                      Serving profile
                    </th>
                    <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                      Parent
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {familyCheckpoints.map((checkpoint) => (
                    <tr key={checkpoint.id}>
                      <td className="border-b border-slate-800/50 p-2 text-slate-200">{checkpoint.name}</td>
                      <td className="border-b border-slate-800/50 p-2 font-mono text-xs text-slate-400">
                        {checkpoint.path}
                      </td>
                      <td className="border-b border-slate-800/50 p-2 text-slate-300">
                        {checkpoint.serving_profile_name}
                      </td>
                      <td className="border-b border-slate-800/50 p-2 text-slate-300">
                        {parentName(checkpoint, data)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
