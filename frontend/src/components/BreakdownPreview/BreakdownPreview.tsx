import { Link } from 'react-router'
import type { DiagnosticsBucket } from '../../api/client'
import { paths } from '../../utils/paths'
import { bucketLostCountText, previewBuckets, RULE_LEVEL, unitLabelForLevel } from './BreakdownPreview.helper'

interface BreakdownPreviewProps {
  runId: number
  buckets: DiagnosticsBucket[]
}

// "Where the points went": the top 5 weakest buckets by points lost,
// each linking into the Samples tab's own rule filter -- a short
// preview, not the full breakdown table (that stays on the Samples
// tab, in FailureBreakdown, collapsed by default). GSM8K and
// GPQA-Diamond have no bucket breakdown at all, so this degrades to a
// note and a plain link instead of an empty list.
export function BreakdownPreview({ runId, buckets }: BreakdownPreviewProps) {
  const preview = previewBuckets(buckets)

  if (preview === null) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">This benchmark has no failure breakdown.</p>
        <Link
          to={`${paths.runSamples(runId)}?outcome=failed`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Browse failed samples →
        </Link>
      </div>
    )
  }

  const unit = unitLabelForLevel(preview.level)

  return (
    <ul className="space-y-2">
      {preview.rows.map((bucket) => (
        <li key={bucket.name} className="flex items-center justify-between gap-3 text-sm">
          {preview.level === RULE_LEVEL ? (
            <Link
              to={`${paths.runSamples(runId)}?rule=${encodeURIComponent(bucket.name)}`}
              className="truncate font-mono text-xs text-primary hover:underline"
              title={bucket.name}
            >
              {bucket.name}
            </Link>
          ) : (
            <span className="truncate text-foreground" title={bucket.name}>
              {bucket.name}
            </span>
          )}
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {bucketLostCountText(bucket, unit)}
          </span>
        </li>
      ))}
      <li>
        <Link to={paths.runSamples(runId)} className="text-xs font-medium text-primary hover:underline">
          See all breakdowns →
        </Link>
      </li>
    </ul>
  )
}
