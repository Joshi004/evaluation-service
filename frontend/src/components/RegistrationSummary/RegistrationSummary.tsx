import type { RegisterCheckpointRequest, ServingProfileSummary } from '../../api/client'
import { describeServingProfileSelection } from './RegistrationSummary.helper'

interface RegistrationSummaryProps {
  request: RegisterCheckpointRequest
  candidateDisplayName: string
  profiles: ServingProfileSummary[]
  parentCheckpointName: string | null
}

// Step 4: exactly what POST /checkpoints will write, rendered straight
// from the request the Register button is about to send, so this panel
// can never show something different from what actually gets
// submitted. `candidateDisplayName` stands in for `request.reference`
// -- the frontend never renders a path (R-D32).
export function RegistrationSummary({
  request,
  candidateDisplayName,
  profiles,
  parentCheckpointName,
}: RegistrationSummaryProps) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Candidate', value: candidateDisplayName },
    { label: 'Name', value: request.name },
    { label: 'Family', value: request.family ?? '—' },
    { label: 'Parent checkpoint', value: parentCheckpointName ?? '—' },
    {
      label: 'Serving profile',
      value: describeServingProfileSelection(request.serving_profile, profiles),
    },
    { label: 'Registered by', value: request.registered_by ?? '—' },
  ]

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs text-slate-500">{row.label}</dt>
          <dd className="text-sm text-slate-200">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
