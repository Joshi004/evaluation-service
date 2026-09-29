// "Full dataset · 0-shot · 4 repeats" -- the one-line summary of a
// benchmark's evaluation shape, shown on its Choose-step card and its
// Settings-step row (Phase 10, docs/UI_REDESIGN_PLAN.md §8.10) so a
// reader sees what "the recommended settings" actually are without
// opening Customize protocol. Only the three fields that change what
// gets measured are surfaced; think_handling and any per-field
// sampling mandate stay in that panel, the same split
// CheckpointSamplingCard.tsx's own mandate notes already draw.
import type { StandardSummary } from '../api/client'

// sample_limit's own resolved default can legitimately be null -- the
// catalog's own convention for "the full dataset" (mirrors
// StandardOverrideCard.helper.ts's sampleLimitPlaceholder, one call
// site over: that file's version is an input placeholder, this one a
// display summary, so the two stay separate rather than one reaching
// across into the other's component folder).
function formatSampleLimit(sampleLimit: number | null): string {
  return sampleLimit === null ? 'Full dataset' : `${sampleLimit} samples`
}

function formatFewShot(fewShot: number): string {
  return fewShot === 0 ? '0-shot' : `${fewShot}-shot`
}

function formatRepeats(repeats: number): string {
  return repeats === 1 ? '1 repeat' : `${repeats} repeats`
}

export function protocolSummary(standard: StandardSummary): string {
  return [formatSampleLimit(standard.sample_limit), formatFewShot(standard.few_shot), formatRepeats(standard.repeats)].join(
    ' \u00b7 ',
  )
}
