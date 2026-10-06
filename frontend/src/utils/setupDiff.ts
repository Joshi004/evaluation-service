// What actually differs between a baseline run and one or more other
// runs, and the full field-by-field diff table behind it. Lives in
// src/utils/ since the Leaderboard's "Other setups" hover became a
// second caller after Compare's own setup check -- per
// .cursor/rules/frontend-components.mdc, "once a second component
// needs the same logic, promote it to src/utils/".
import type { RunDetail } from '../api/client'
import { samplingFieldRows, servingFieldRows, standardFieldRows, type FieldRow } from './runConfigFieldRows'
import { samplingProfileDisplayName } from './samplingProfileDisplayName'
import { servingProfileDisplayName } from './servingProfileDisplayName'
import { standardDisplayName } from './standardDisplayName'

export interface SetupDifference {
  field: 'Model' | 'Benchmark protocol' | 'Sampling profile' | 'Serving profile'
  baselineLabel: string
  otherLabel: string
}

// Checked in the order a reader would want it explained: which model,
// then what protocol/sampling/serving actually differs. `comparison_hash`
// only covers the protocol and sampling profile, so "Model" and
// "Serving profile" can differ even when the setup itself matches --
// this function reports every one of the four regardless.
export function setupDifferences(baseline: RunDetail, other: RunDetail): SetupDifference[] {
  const differences: SetupDifference[] = []
  if (baseline.checkpoint_id !== other.checkpoint_id) {
    differences.push({ field: 'Model', baselineLabel: baseline.checkpoint_name, otherLabel: other.checkpoint_name })
  }
  if (baseline.standard.hash !== other.standard.hash) {
    differences.push({
      field: 'Benchmark protocol',
      baselineLabel: standardDisplayName(baseline.standard.label, baseline.standard.hash),
      otherLabel: standardDisplayName(other.standard.label, other.standard.hash),
    })
  }
  if (baseline.sampling.hash !== other.sampling.hash) {
    differences.push({
      field: 'Sampling profile',
      baselineLabel: samplingProfileDisplayName(baseline.sampling.label, baseline.sampling.hash),
      otherLabel: samplingProfileDisplayName(other.sampling.label, other.sampling.hash),
    })
  }
  if (baseline.serving.hash !== other.serving.hash) {
    differences.push({
      field: 'Serving profile',
      baselineLabel: servingProfileDisplayName(baseline.serving.label, baseline.serving.hash),
      otherLabel: servingProfileDisplayName(other.serving.label, other.serving.hash),
    })
  }
  return differences
}

export function differenceSummaryText(difference: SetupDifference): string {
  return `${difference.field}: ${difference.baselineLabel} → ${difference.otherLabel}`
}

export interface FieldDiffRow {
  label: string
  // One value per run, in the same order as the `runs` array the
  // table was built from -- runs[0] is always the baseline.
  values: string[]
  anyDiffers: boolean
}

function buildFieldDiffRows(runs: RunDetail[], rowsForRun: (run: RunDetail) => FieldRow[]): FieldDiffRow[] {
  const perRunRows = runs.map(rowsForRun)
  const labels = perRunRows[0]?.map((row) => row.label) ?? []
  return labels
    .map((label, index) => {
      const values = perRunRows.map((rows) => rows[index]?.value ?? '—')
      const anyDiffers = values.some((value) => value !== values[0])
      return { label, values, anyDiffers }
    })
    .filter((row) => row.anyDiffers)
}

function engineOptionDiffRows(runs: RunDetail[]): FieldDiffRow[] {
  const allKeys = new Set<string>()
  for (const run of runs) {
    for (const key of Object.keys(run.serving.engine_options)) {
      allKeys.add(key)
    }
  }
  return [...allKeys]
    .map((key) => {
      const values = runs.map((run) => {
        const value = run.serving.engine_options[key]
        return value === undefined ? '—' : String(value)
      })
      const anyDiffers = values.some((value) => value !== values[0])
      return { label: key, values, anyDiffers }
    })
    .filter((row) => row.anyDiffers)
}

// "Show differences" own table: every resolved field across every run,
// kept only where at least one run's value differs from the
// baseline's -- built from the same row lists RunConfigTab already
// uses, so this never disagrees with the Configuration tab.
export function buildSetupDiffTable(runs: RunDetail[]): FieldDiffRow[] {
  return [
    ...buildFieldDiffRows(runs, (run) => standardFieldRows(run.standard)),
    ...buildFieldDiffRows(runs, (run) => samplingFieldRows(run.sampling)),
    ...buildFieldDiffRows(runs, (run) => servingFieldRows(run.serving)),
    ...engineOptionDiffRows(runs),
  ]
}
