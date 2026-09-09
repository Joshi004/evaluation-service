// Non-DOM logic for InspectionSummary.tsx: turning a CheckpointInspection
// into display-ready label/value pairs. Kept as a conversion function
// separate from the component so the component itself only ever
// receives `InferredField[]` -- from Phase 8 on, a second conversion
// function can produce the same shape from an already-registered
// checkpoint's stored CheckpointInferredMetadata, and the component
// underneath needs no change to render it.
import type { CheckpointInspection } from '../../api/client'

export interface InferredField {
  label: string
  value: string
}

function formatNullable(value: string | number | null): string {
  return value === null ? '—' : String(value)
}

// Decimal (GB = 10^9 bytes), matching how `du` on the cluster and disk
// vendors both report size -- binary MiB/GiB would be a second unit
// system for no benefit here.
export function formatSizeBytes(sizeBytes: number | null): string {
  if (sizeBytes === null) {
    return '—'
  }
  if (sizeBytes >= 1_000_000_000) {
    return `${(sizeBytes / 1_000_000_000).toFixed(1)} GB`
  }
  return `${(sizeBytes / 1_000_000).toFixed(1)} MB`
}

export function inferredFieldsFromInspection(inspection: CheckpointInspection): InferredField[] {
  return [
    { label: 'Model type', value: formatNullable(inspection.model_type) },
    { label: 'Architecture', value: formatNullable(inspection.architecture) },
    { label: 'Base model', value: formatNullable(inspection.base_model) },
    {
      label: 'Context length',
      value: inspection.context_length === null ? '—' : inspection.context_length.toLocaleString(),
    },
    { label: 'Torch dtype', value: formatNullable(inspection.torch_dtype) },
    { label: 'Quantization', value: formatNullable(inspection.quantization) },
    { label: 'Weight format', value: formatNullable(inspection.weight_format) },
    { label: 'Shard count', value: formatNullable(inspection.shard_count) },
    { label: 'Size', value: formatSizeBytes(inspection.size_bytes) },
  ]
}
