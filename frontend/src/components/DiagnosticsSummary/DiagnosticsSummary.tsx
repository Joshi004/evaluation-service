import type { DiagnosticsSummary as DiagnosticsSummaryData } from '../../api/client'
import { tagChipLabel } from './DiagnosticsSummary.helper'

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
export function DiagnosticsSummary({ summary, activeTag, onTagChange }: DiagnosticsSummaryProps) {
  if (summary.narrative.length === 0 && summary.tag_counts.length === 0) {
    return null
  }

  function handleChipClick(tag: string) {
    // Clicking the already-active chip clears the filter -- the same
    // toggle FailureBreakdown's rule rows use.
    onTagChange(activeTag === tag ? null : tag)
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
      {summary.narrative.map((sentence) => (
        <p key={sentence} className="mt-2 text-sm text-slate-300 first:mt-0">
          {sentence}
        </p>
      ))}

      {summary.tag_counts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.tag_counts.map((tagCount) => {
            const isActive = tagCount.tag === activeTag
            return (
              <button
                key={tagCount.tag}
                type="button"
                onClick={() => handleChipClick(tagCount.tag)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  isActive
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tagChipLabel(tagCount)}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
