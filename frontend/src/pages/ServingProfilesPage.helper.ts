// Non-DOM logic for ServingProfilesPage.tsx: reshaping a
// ServingProfileSummary into the label/value rows its expanded row
// renders.
import type { ServingProfileSummary } from '../api/client'

export interface ServingProfileValueRow {
  field: string
  label: string
  value: string
}

// Every ServingProfileConfig field except engine_options (rendered
// separately below, since its keys aren't fixed across profiles),
// labelled the same way ServingProfilePicker.tsx's customisation form
// already labels them -- one label set for e.g.
// "tensor_parallel_size" across the app, not two.
export function buildServingValueRows(profile: ServingProfileSummary): ServingProfileValueRow[] {
  return [
    { field: 'engine', label: 'Engine', value: profile.engine },
    { field: 'engine_version', label: 'Engine version', value: profile.engine_version },
    { field: 'gpus', label: 'GPUs', value: String(profile.gpus) },
    { field: 'tensor_parallel_size', label: 'Tensor parallel size', value: String(profile.tensor_parallel_size) },
    {
      field: 'pipeline_parallel_size',
      label: 'Pipeline parallel size',
      value: String(profile.pipeline_parallel_size),
    },
    {
      field: 'max_model_len',
      label: 'Max model length',
      value: profile.max_model_len === null ? '—' : String(profile.max_model_len),
    },
    { field: 'reasoning_parser', label: 'Reasoning parser', value: profile.reasoning_parser ?? '—' },
    { field: 'dtype', label: 'Dtype', value: profile.dtype },
    { field: 'quantization', label: 'Quantization', value: profile.quantization ?? '—' },
    {
      field: 'gpu_memory_utilization',
      label: 'GPU memory utilization',
      value: String(profile.gpu_memory_utilization),
    },
  ]
}

// engine_options' keys vary per profile -- it's an escape hatch for
// uncommon engine flags (R-D6) -- so its entries are listed on their
// own rather than forced into ServingProfileValueRow's fixed field set.
export function engineOptionEntries(profile: ServingProfileSummary): [string, string | number | boolean][] {
  return Object.entries(profile.engine_options)
}
