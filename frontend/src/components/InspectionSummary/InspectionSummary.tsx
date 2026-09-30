import { JsonDetails } from '../JsonDetails/JsonDetails'
import type { InferredField } from './InspectionSummary.helper'

interface InspectionSummaryProps {
  fields: InferredField[]
  missingRequirements: string[]
  problems: string[]
  sourceConfig: Record<string, unknown> | null
}

// Step 2 of the registration wizard, and the model page's own
// Configuration tab (Phase 11): every field the server inferred from
// the cluster, what -- if anything -- blocks registering it, and
// anything else it could not read. Every field here is read-only: the
// server re-reads the checkpoint at registration regardless of what
// the form shows (R-D4), so nothing here is wired to an onChange. An
// already-registered checkpoint has no missing requirements or
// problems of its own (both only exist for a fresh inspection), so the
// Configuration tab's own call simply passes empty arrays for both.
export function InspectionSummary({ fields, missingRequirements, problems, sourceConfig }: InspectionSummaryProps) {
  return (
    <div>
      {missingRequirements.length > 0 && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger-soft p-3">
          <p className="text-sm font-medium text-danger">This checkpoint cannot be registered</p>
          <ul className="mt-1 space-y-0.5">
            {missingRequirements.map((reason) => (
              <li key={reason} className="text-xs text-danger">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {problems.length > 0 && (
        <div className="mb-4 rounded-md border border-warning/30 bg-warning-soft p-3">
          <p className="text-sm font-medium text-warning">
            {problems.length} thing{problems.length === 1 ? '' : 's'} could not be read
          </p>
          <ul className="mt-1 space-y-0.5">
            {problems.map((problem) => (
              <li key={problem} className="text-xs text-warning">
                {problem}
              </li>
            ))}
          </ul>
        </div>
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
