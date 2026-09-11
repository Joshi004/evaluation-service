import { useQuery } from '@tanstack/react-query'
import { apiFetch, type ServingProfileSummary } from '../api/client'
import { CatalogPanel } from '../components/CatalogPanel/CatalogPanel'
import { servingProfileDisplayName } from '../utils/servingProfileDisplayName'
import { buildServingValueRows, engineOptionEntries } from './ServingProfilesPage.helper'

export function ServingProfilesPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['serving-profiles'],
    queryFn: () => apiFetch<ServingProfileSummary[]>('/serving-profiles'),
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
    return <ServingProfileValues profile={profile} />
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Serving Profiles</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        How a checkpoint's vLLM server is started -- engine, parallelism, context length, and the rest
        of the eleven hashable fields (docs/CHECKPOINT_REGISTRATION_PHASES.md). Not part of a run's
        comparison hash (S-D5): two runs can share a leaderboard cell under different serving profiles.
      </p>

      <div className="mt-6">
        <CatalogPanel
          resourcePath="/serving-profiles"
          listQueryKey={['serving-profiles']}
          entryNoun="serving profile"
          renderRowValues={renderRowValues}
        />
      </div>
    </div>
  )
}

function ServingProfileValues({ profile }: { profile: ServingProfileSummary }) {
  const rows = buildServingValueRows(profile)
  const engineOptions = engineOptionEntries(profile)

  return (
    <div>
      <p className="text-sm text-slate-300">{servingProfileDisplayName(profile.label, profile.hash)}</p>
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
          {engineOptions.length > 0 && (
            <tr>
              <td className="w-48 border-b border-slate-800/50 p-2 align-top text-slate-400">
                Engine options
              </td>
              <td className="border-b border-slate-800/50 p-2 align-top font-mono text-slate-100">
                <ul className="space-y-0.5">
                  {engineOptions.map(([key, value]) => (
                    <li key={key}>
                      {key}: {String(value)}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
