import { Callout } from '../Callout/Callout'
import { JsonDetails } from '../JsonDetails/JsonDetails'
import type { InferredField } from './InspectionSummary.helper'

interface InspectionSummaryProps {
  fields: InferredField[]
  missingRequirements: string[]
  problems: string[]
  sourceConfig: Record<string, unknown> | null
}

// Step 2 of the registration wizard, and the model page's own
// Configuration tab: every field the server inferred from the
// cluster, what -- if anything -- blocks registering it, and anything
// else it could not read. Every field here is read-only: the server
// re-reads the checkpoint at registration regardless of what the form
// shows, so nothing here is wired to an onChange. An already-registered
// checkpoint has no missing requirements or problems of its own (both
// only exist for a fresh inspection), so the Configuration tab's own
// call simply passes empty arrays for both.
export function InspectionSummary({ fields, missingRequirements, problems, sourceConfig }: InspectionSummaryProps) {
  return (
    <div>
      {missingRequirements.length > 0 && (
        <Callout tone="danger" title="This checkpoint cannot be registered" className="mb-4">
          <ul className="space-y-0.5">
            {missingRequirements.map((reason) => (
              <li key={reason} className="text-xs text-danger">
                {reason}
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {problems.length > 0 && (
        <Callout
          tone="warning"
          title={`${problems.length} thing${problems.length === 1 ? '' : 's'} could not be read`}
          className="mb-4"
        >
          <ul className="space-y-0.5">
            {problems.map((problem) => (
              <li key={problem} className="text-xs text-warning">
                {problem}
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd className="text-sm text-foreground">{field.value}</dd>
          </div>
        ))}
      </dl>

      {sourceConfig && <JsonDetails summary="config.json (verbatim)" value={sourceConfig} className="mt-4" />}
    </div>
  )
}
