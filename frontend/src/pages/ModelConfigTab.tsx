import { Link } from 'react-router'
import { useSamplingProfiles } from '../api/queries/samplingProfiles'
import { useServingProfiles } from '../api/queries/servingProfiles'
import { AvailabilityBadge } from '../components/AvailabilityBadge/AvailabilityBadge'
import { Card } from '../components/Card/Card'
import { CheckWeightsButton } from '../components/CheckWeightsButton/CheckWeightsButton'
import { CopyButton } from '../components/CopyButton/CopyButton'
import { FingerprintChip } from '../components/FingerprintChip/FingerprintChip'
import { InspectionSummary } from '../components/InspectionSummary/InspectionSummary'
import { inferredFieldsFromCheckpoint } from '../components/InspectionSummary/InspectionSummary.helper'
import { JsonDetails } from '../components/JsonDetails/JsonDetails'
import { KeyValueList } from '../components/KeyValueList/KeyValueList'
import { RelativeTime } from '../components/RelativeTime/RelativeTime'
import { TermLabel } from '../components/TermLabel/TermLabel'
import { TERM_HINTS } from '../utils/labels'
import { samplingSummary } from '../utils/samplingSummary'
import { describeProfileGlance } from '../utils/servingProfileSummary'
import { paths } from '../utils/paths'
import { useModelPage } from './ModelDetailPage.helper'

// The model page's Configuration tab (docs/UI_REDESIGN_PLAN.md §8.11):
// everything the old checkpoints-page expandable row showed (the nine
// inferred fields, config.json, weights, path, serving profile,
// parent), as Card + KeyValueList groups instead of one dense row.
export function ModelConfigTab() {
  const { checkpoint, allCheckpoints } = useModelPage()
  const servingProfiles = useServingProfiles()
  const samplingProfiles = useSamplingProfiles()

  // The full profile object (needed for describeProfileGlance/
  // samplingSummary's richer one-line description) may not have
  // loaded yet, or the checkpoint's own id may point at a profile the
  // catalog no longer returns -- either way, the checkpoint's own
  // joined-in label/hash fields (always present) are a safe fallback.
  const servingProfile =
    servingProfiles.data?.find((profile) => profile.id === checkpoint.default_serving_profile_id) ?? null
  const samplingProfile =
    samplingProfiles.data?.find((profile) => profile.id === checkpoint.default_sampling_profile_id) ?? null

  const parent = allCheckpoints.find((candidate) => candidate.id === checkpoint.parent_checkpoint_id) ?? null

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-sm font-medium text-foreground">What the model says</h2>
        <div className="mt-3">
          <InspectionSummary
            fields={inferredFieldsFromCheckpoint(checkpoint.inferred)}
            // Both are inspect-time concepts (CheckpointInspection's own
            // fields) with no stored counterpart on an already-registered
            // checkpoint -- the old checkpoints list's expandable row,
            // which this tab replaces, used the identical reasoning.
            missingRequirements={[]}
            problems={[]}
            sourceConfig={checkpoint.inferred.source_config}
          />
        </div>
        {checkpoint.generation_config !== null && (
          <JsonDetails
            summary="Generation config (verbatim)"
            value={checkpoint.generation_config}
            className="mt-4"
          />
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-foreground">Default profiles</h2>
        <KeyValueList
          className="mt-3"
          rows={[
            {
              label: <TermLabel hint={TERM_HINTS.servingProfile}>Serving profile</TermLabel>,
              value: servingProfile ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>{describeProfileGlance(servingProfile)}</span>
                  <FingerprintChip hash={servingProfile.hash} />
                </span>
              ) : (
                <FingerprintChip
                  hash={checkpoint.serving_profile_hash}
                  label={checkpoint.serving_profile_label ?? undefined}
                />
              ),
            },
            {
              label: <TermLabel hint={TERM_HINTS.samplingProfile}>Sampling profile</TermLabel>,
              value: samplingProfile ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>{samplingSummary(samplingProfile)}</span>
                  <FingerprintChip hash={samplingProfile.hash} />
                </span>
              ) : (
                <FingerprintChip
                  hash={checkpoint.default_sampling_profile_hash}
                  label={checkpoint.default_sampling_profile_label ?? undefined}
                />
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-foreground">Registration</h2>
        <KeyValueList
          className="mt-3"
          rows={[
            {
              label: 'Path',
              value: (
                <span className="inline-flex items-center gap-1.5">
                  <span className="break-all font-mono text-xs">{checkpoint.path}</span>
                  <CopyButton value={checkpoint.path} label="Copy path" />
                </span>
              ),
            },
            { label: 'Registered by', value: checkpoint.registered_by ?? '\u2014' },
            { label: 'Registered', value: <RelativeTime timestamp={checkpoint.created_at} /> },
            {
              label: 'Parent',
              value: parent ? (
                <Link to={paths.model(parent.id)} className="text-primary hover:underline">
                  {parent.name}
                </Link>
              ) : (
                '\u2014'
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-foreground">
          <TermLabel hint={TERM_HINTS.weights}>Weights</TermLabel>
        </h2>
        <KeyValueList
          className="mt-3"
          rows={[
            { label: 'Status', value: <AvailabilityBadge status={checkpoint.availability_status} /> },
            { label: 'Checked', value: <RelativeTime timestamp={checkpoint.availability_checked_at} /> },
            { label: 'Detail', value: checkpoint.availability_detail ?? '\u2014' },
          ]}
        />
        <CheckWeightsButton checkpointId={checkpoint.id} checkpointName={checkpoint.name} className="mt-3" />
      </Card>
    </div>
  )
}
