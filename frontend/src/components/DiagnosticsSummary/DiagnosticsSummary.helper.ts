// Non-DOM logic for DiagnosticsSummary.tsx: the tag chip's own label
// text. Kept out of the component body per
// .cursor/rules/frontend-components.mdc.

import type { DiagnosticsTagCount } from '../../api/client'
import { tagLabel } from '../../utils/tagLabel'

// "Near miss (54)" -- the chip's own count, visible without a click.
export function tagChipLabel(tagCount: DiagnosticsTagCount): string {
  return `${tagLabel(tagCount.tag)} (${tagCount.n_samples})`
}
