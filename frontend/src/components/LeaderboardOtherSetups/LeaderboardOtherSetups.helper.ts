import type { RunDetail } from '../../api/client'
import { buildSetupDiffTable, differenceSummaryText, setupDifferences, type FieldDiffRow } from '../../utils/setupDiff'

export interface OtherSetupDiff {
  // One line per part of the setup that differs (benchmark protocol,
  // sampling profile, serving profile), named the way the rest of the
  // app names them. Covers a difference the field rows below can't
  // show, e.g. a changed prompt template, which is part of the
  // protocol's identity but not one of its listed fields.
  summaries: string[]
  // Only the resolved fields whose value differs between the two runs
  // -- `values[0]` is the run on screen, `values[1]` the other one.
  fieldRows: FieldDiffRow[]
}

export function buildOtherSetupDiff(shownRun: RunDetail, otherRun: RunDetail): OtherSetupDiff {
  return {
    summaries: setupDifferences(shownRun, otherRun).map(differenceSummaryText),
    fieldRows: buildSetupDiffTable([shownRun, otherRun]),
  }
}
