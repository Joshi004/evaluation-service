// Collapses runs of whitespace to a single space and trims. Every
// output_preview on run-13 literally begins with "\n\n" (the
// leading-blank-line finding in docs/SCORE_DRILLDOWN_UI_PLAN.md Section
// 7) -- rendered raw in a clamped one-line cell, that reads as an empty
// row. The untouched text still matters, so it stays visible verbatim
// on Phase 7's sample detail page; this just keeps a table cell
// readable.
//
// Promoted from SampleList.helper.ts once FlipList (Phase 9) needed the
// same formatting for its own preview columns
// (.cursor/rules/frontend-components.mdc: "once a second component
// needs the same logic, promote it to src/utils/").
export function previewText(preview: string): string {
  return preview.replace(/\s+/g, ' ').trim()
}
