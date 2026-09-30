import { useSamplingProfiles } from '../../api/queries/samplingProfiles'
import { Badge } from '../Badge/Badge'
import { Tooltip } from '../Tooltip/Tooltip'
import { samplingProfileDisplayName } from '../../utils/samplingProfileDisplayName'
import { samplingSummary } from '../../utils/samplingSummary'
import { TERM_HINTS } from '../../utils/labels'

interface SetupChipProps {
  samplingProfileLabel: string | null
  samplingProfileHash: string
  className?: string
}

// Renders "Setup" (comparison_hash's UI label) as a chip -- the
// tooltip spells out the resolved sampling profile behind the label
// ("Thinking on · T 1 · top-p 0.95 · 32k tokens") plus why setup
// matters, so a reader never has to guess what two same-named columns
// actually differ by. Never shows the raw hash as the primary label;
// an unlabelled profile falls through to samplingProfileDisplayName's
// own hash fallback instead.
export function SetupChip({ samplingProfileLabel, samplingProfileHash, className }: SetupChipProps) {
  const samplingProfiles = useSamplingProfiles()
  const label = samplingProfileDisplayName(samplingProfileLabel, samplingProfileHash)
  const profile = samplingProfiles.data?.find((candidate) => candidate.hash === samplingProfileHash)

  return (
    <Tooltip
      content={
        <div className="max-w-xs space-y-1">
          {profile && <p>{samplingSummary(profile)}</p>}
          <p className="text-muted-foreground">{TERM_HINTS.setup}</p>
        </div>
      }
    >
      <span tabIndex={0}>
        <Badge tone="neutral" className={className}>
          {label}
        </Badge>
      </span>
    </Tooltip>
  )
}
