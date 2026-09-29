import type { DiagnosticsSummary as DiagnosticsSummaryData } from '../../api/client'
import { cn } from '../../utils/cn'
import { tagChipLabel, tagOverlapCaption } from './DiagnosticsSummary.helper'

interface DiagnosticsSummaryProps {
  summary: DiagnosticsSummaryData
  activeTag: string | null
  onTagChange: (tag: string | null) => void
}

// The written summary and tag chip row (docs/SCORE_DRILLDOWN_UI_PLAN.md
// Section 6; docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 8):
// deterministic sentences computed from thresholds over the same
// counts the tag chips show, never an LLM call -- "a wrong summary
// about wrongness is worse than no summary." Chips, not a pie chart,
// because one sample can carry several tags.
//
// Bare content, no card chrome of its own (Phase 7,
// docs/UI_REDESIGN_PLAN.md §8.7): the Samples tab and the Overview
// tab's own "What the data says" panel each wrap this in their own
// Card, so it composes into either without a nested double border.
// `onTagChange` means two different things depending on which one --
// the Samples tab wires it to its own URL filter (an in-place toggle);
// the Overview tab wires it to a navigation into the Samples tab
// instead (docs/UI_REDESIGN_PLAN.md §8.7, item 4: "tag chips that link
// to filtered Samples") -- this component only ever calls it, never
// cares which.
export function DiagnosticsSummary({ summary, activeTag, onTagChange }: DiagnosticsSummaryProps) {
  if (summary.narrative.length === 0 && summary.tag_counts.length === 0) {
    return null
  }

  function handleChipClick(tag: string) {
    // Clicking the already-active chip clears the filter -- the same
    // toggle FailureBreakdown's rule rows use. Meaningless on the
    // Overview tab (activeTag is always null there, since nothing is
    // filtered yet), so it is simply never triggered from that caller.
    onTagChange(activeTag === tag ? null : tag)
  }

  return (
    <div className="space-y-3">
      {summary.narrative.map((sentence) => (
        <p key={sentence} className="text-sm text-foreground">
          {sentence}
        </p>
      ))}

      {summary.tag_counts.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {summary.tag_counts.map((tagCount) => {
              const isActive = tagCount.tag === activeTag
              return (
                <button
                  key={tagCount.tag}
                  type="button"
                  onClick={() => handleChipClick(tagCount.tag)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    isActive ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground hover:bg-border',
                  )}
                >
                  {tagChipLabel(tagCount)}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-subtle-foreground">{tagOverlapCaption(summary.failed)}</p>
        </div>
      )}
    </div>
  )
}
