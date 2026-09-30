// Non-DOM logic for RunsTableRow.tsx: the Result column's own
// truncation line -- a second line reads '0.0% truncated', in the
// warning tone when above zero.

import { formatFractionAsPercent } from '../../utils/formatFractionAsPercent'

export interface TruncationDisplay {
  text: string
  toneClassName: string
}

// `null` when the run has no truncation_rate at all -- never true for
// a `done` run in practice, but the field is nullable on the type, and
// a row with nothing to show should render nothing rather than "—
// truncated".
export function truncationDisplay(truncationRate: number | null): TruncationDisplay | null {
  if (truncationRate === null) {
    return null
  }
  return {
    text: `${formatFractionAsPercent(truncationRate)} truncated`,
    toneClassName: truncationRate > 0 ? 'text-warning' : 'text-muted-foreground',
  }
}
