// Reshapes a run's resolved standard, sampling and serving profiles
// into the label/value rows a grouped card renders. Promoted from
// pages/RunConfigTab.helper.ts (Phase 7) to src/utils/ once Compare's
// own setup check (Phase 8, docs/UI_REDESIGN_PLAN.md §8.8) became a
// second caller -- per .cursor/rules/frontend-components.mdc, "once a
// second component needs the same logic, promote it to src/utils/".

import type { RunSamplingDetail, RunStandardDetail, ServingProfileSummary } from '../api/client'
import { THINK_HANDLING_LABELS } from './labels'

export interface FieldRow {
  label: string
  value: string
}

// `null` covers both the standard's own nullable fields
// (dataset_revision, split, sample_limit) and the endpoint's
// slurm_job_id; numbers and booleans are stringified so every row in
// the resulting table is a plain string, matching FieldRow.
export function displayOrDash(value: string | number | boolean | null): string {
  if (value === null) {
    return '—'
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  return String(value)
}

// The fields a human needs to know exactly what ran, from the resolved
// standard -- task/dataset shape plus think_handling. prompt_template,
// few_shot_prompt_template and extraction are left out: all three are
// better suited to the Benchmarks page's own raw-YAML view (Phase 12)
// than to a run's configuration summary.
export function standardFieldRows(standard: RunStandardDetail): FieldRow[] {
  return [
    { label: 'Benchmark', value: standard.benchmark },
    { label: 'Framework', value: standard.framework },
    { label: 'Framework image', value: standard.framework_image },
    { label: 'Task', value: standard.task_name },
    { label: 'Dataset', value: standard.dataset_name },
    { label: 'Dataset revision', value: displayOrDash(standard.dataset_revision) },
    { label: 'Split', value: displayOrDash(standard.split) },
    { label: 'Train split', value: displayOrDash(standard.train_split) },
    { label: 'Few-shot', value: displayOrDash(standard.few_shot) },
    { label: 'Repeats', value: displayOrDash(standard.repeats) },
    { label: 'Sample limit', value: displayOrDash(standard.sample_limit) },
    { label: 'Think handling', value: THINK_HANDLING_LABELS[standard.think_handling] },
    { label: 'Subsets', value: standard.subsets.join(', ') },
    { label: 'Eval batch size', value: displayOrDash(standard.eval_batch_size) },
    { label: 'Request timeout (s)', value: displayOrDash(standard.request_timeout_seconds) },
  ]
}

// The fields a human needs to know exactly how the model was asked to
// speak, from the run's resolved sampling profile.
export function samplingFieldRows(sampling: RunSamplingDetail): FieldRow[] {
  return [
    { label: 'Temperature', value: displayOrDash(sampling.temperature) },
    { label: 'Top-p', value: displayOrDash(sampling.top_p) },
    { label: 'Top-k', value: displayOrDash(sampling.top_k) },
    { label: 'Min-p', value: displayOrDash(sampling.min_p) },
    { label: 'Presence penalty', value: displayOrDash(sampling.presence_penalty) },
    { label: 'Repetition penalty', value: displayOrDash(sampling.repetition_penalty) },
    { label: 'Max tokens', value: displayOrDash(sampling.max_tokens) },
    { label: 'Enable thinking', value: displayOrDash(sampling.enable_thinking) },
    { label: 'Seed', value: displayOrDash(sampling.seed) },
  ]
}

// The fields a human needs to know exactly how the model's server was
// started, from the run's own recorded serving profile (not necessarily
// the checkpoint's current default). engine_options is left out --
// its keys vary per profile, so RunConfigTab renders it as its own list
// below this grid, the same call ServingProfilesPage.helper.ts's
// buildServingValueRows already makes for the Serving Profiles page.
export function servingFieldRows(serving: ServingProfileSummary): FieldRow[] {
  return [
    { label: 'Engine', value: serving.engine },
    { label: 'Engine version', value: serving.engine_version },
    { label: 'GPUs', value: String(serving.gpus) },
    { label: 'Tensor parallel size', value: String(serving.tensor_parallel_size) },
    { label: 'Pipeline parallel size', value: String(serving.pipeline_parallel_size) },
    { label: 'Max model length', value: displayOrDash(serving.max_model_len) },
    { label: 'Reasoning parser', value: serving.reasoning_parser ?? '—' },
    { label: 'Dtype', value: serving.dtype },
    { label: 'Quantization', value: serving.quantization ?? '—' },
    { label: 'GPU memory utilization', value: String(serving.gpu_memory_utilization) },
  ]
}

// engine_options' keys vary per profile -- it's an escape hatch for
// uncommon engine flags (R-D6) -- so its entries are listed on their
// own rather than forced into servingFieldRows' fixed field set.
// Relocated from the deleted ServingProfilesPage.helper.ts in Phase 12
// (docs/UI_REDESIGN_PLAN.md §8.12), next to servingFieldRows since
// RunConfigTab.tsx already renders the two side by side.
export function engineOptionEntries(profile: ServingProfileSummary): [string, string | number | boolean][] {
  return Object.entries(profile.engine_options)
}
