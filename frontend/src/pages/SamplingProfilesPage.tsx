import { useQuery } from '@tanstack/react-query'
import { apiFetch, type SamplingProfileSummary } from '../api/client'
import { CatalogPanel } from '../components/CatalogPanel/CatalogPanel'
import { samplingProfileDisplayName } from '../utils/samplingProfileDisplayName'
import { buildSamplingValueRows } from '../utils/samplingProfileValueRows'

export function SamplingProfilesPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sampling-profiles'],
    queryFn: () => apiFetch<SamplingProfileSummary[]>('/sampling-profiles'),
  })

  // Looked up by id rather than passed down directly -- CatalogPanel
  // only knows a row's id (from catalog-status), not its full config,
  // so the two queries meet here.
  function renderRowValues(rowId: number) {
    if (isLoading) {
      return <p className="text-sm text-slate-500">Loading…</p>
    }
    if (isError) {
      return <p className="text-sm text-red-400">Could not load values: {String(error)}</p>
    }
    const profile = data?.find((candidate) => candidate.id === rowId)
    if (!profile) {
      return <p className="text-sm text-slate-500">Profile not found.</p>
    }
    return <SamplingProfileValues profile={profile} />
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Sampling Profiles</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        How a checkpoint is asked to speak -- temperature, penalties, thinking, and the rest of Layer 2
        (docs/STANDARDS_AND_PROFILES_PHASES.md). A standard's own sampling overrides, shown on the
        Standards page, can still change one of these values for a specific benchmark.
      </p>

      <div className="mt-6">
        <CatalogPanel
          resourcePath="/sampling-profiles"
          listQueryKey={['sampling-profiles']}
          entryNoun="sampling profile"
          renderRowValues={renderRowValues}
        />
      </div>
    </div>
  )
}

function SamplingProfileValues({ profile }: { profile: SamplingProfileSummary }) {
  const rows = buildSamplingValueRows(profile)

  return (
    <div>
      <p className="text-sm text-slate-300">{samplingProfileDisplayName(profile.label, profile.hash)}</p>
      <table className="mt-2 w-full border-collapse text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.field}>
              <td className="w-48 border-b border-slate-800/50 p-2 align-top text-slate-400">{row.label}</td>
              <td className="border-b border-slate-800/50 p-2 align-top font-mono text-slate-100">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
