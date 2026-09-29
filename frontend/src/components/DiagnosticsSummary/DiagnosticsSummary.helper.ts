// Non-DOM logic for DiagnosticsSummary.tsx: the tag chip's own label
// text and the overlap caption beneath the chip row. Kept out of the
// component body per .cursor/rules/frontend-components.mdc.

import type { DiagnosticsTagCount } from '../../api/client'
import { tagLabel } from '../../utils/tagLabel'

// "Near miss (54)" -- the chip's own count, visible without a click.
export function tagChipLabel(tagCount: DiagnosticsTagCount): string {
  return `${tagLabel(tagCount.tag)} (${tagCount.n_samples})`
}

// "Tags overlap, so they don't add up to 79 failures." --
// docs/UI_REDESIGN_PLAN.md §8.7's own pitfall about these chips:
// "present them as filters, never as a partition ... that implies they
// add up." One sample can carry several tags (a near miss that's also
// cosmetic), so the counts across chips can exceed the total failed
// count.
export function tagOverlapCaption(failed: number): string {
  return `Tags overlap, so they don't add up to ${failed} failure${failed === 1 ? '' : 's'}.`
}
