import type { RegisterCheckpointRequest, ServingProfileSummary } from '../../api/client'
import { KeyValueList } from '../KeyValueList/KeyValueList'
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
  return (
    <KeyValueList
      rows={[
        { label: 'Candidate', value: candidateDisplayName },
        { label: 'Name', value: request.name },
        { label: 'Family', value: request.family ?? '\u2014' },
        { label: 'Parent checkpoint', value: parentCheckpointName ?? '\u2014' },
        { label: 'Serving profile', value: describeServingProfileSelection(request.serving_profile, profiles) },
        { label: 'Registered by', value: request.registered_by ?? '\u2014' },
      ]}
    />
  )
}
