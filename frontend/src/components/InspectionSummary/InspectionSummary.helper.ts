// Non-DOM logic for InspectionSummary.tsx: turning a CheckpointInspection
// (a fresh discovery) or a CheckpointInferredMetadata (an
// already-registered checkpoint) into the same display-ready
// label/value pairs. Kept as conversion functions separate from the
// component so the component itself only ever receives
// `InferredField[]` and needs no change to render either source.
import type { CheckpointInferredMetadata, CheckpointInspection } from '../../api/client'

export interface InferredField {
  label: string
  value: string
}

// The nine fields both source types share -- structural typing lets
// either CheckpointInspection or CheckpointInferredMetadata satisfy
// this without a cast.
interface InferredMetadataFields {
  model_type: string | null
  architecture: string | null
  base_model: string | null
  context_length: number | null
  torch_dtype: string | null
  quantization: string | null
  weight_format: string | null
  shard_count: number | null
  size_bytes: number | null
}

// "Not stated" rather than "—": null here means the server genuinely
// could not read this off the checkpoint, which reads as more than an
// empty dash in both the Configuration tab and the registration
// wizard's own step 2.
function formatNullable(value: string | number | null): string {
  return value === null ? 'Not stated' : String(value)
}

// Decimal (GB = 10^9 bytes), matching how `du` on the cluster and disk
// vendors both report size -- binary MiB/GiB would be a second unit
// system for no benefit here.
export function formatSizeBytes(sizeBytes: number | null): string {
  if (sizeBytes === null) {
    return 'Not stated'
  }
  if (sizeBytes >= 1_000_000_000) {
    return `${(sizeBytes / 1_000_000_000).toFixed(1)} GB`
  }
  return `${(sizeBytes / 1_000_000).toFixed(1)} MB`
}

function inferredFields(metadata: InferredMetadataFields): InferredField[] {
  return [
    { label: 'Model type', value: formatNullable(metadata.model_type) },
    { label: 'Architecture', value: formatNullable(metadata.architecture) },
    { label: 'Base model', value: formatNullable(metadata.base_model) },
    {
      label: 'Context length',
      value: metadata.context_length === null ? 'Not stated' : metadata.context_length.toLocaleString(),
    },
    { label: 'Torch dtype', value: formatNullable(metadata.torch_dtype) },
    { label: 'Quantization', value: formatNullable(metadata.quantization) },
    { label: 'Weight format', value: formatNullable(metadata.weight_format) },
    { label: 'Shard count', value: formatNullable(metadata.shard_count) },
    { label: 'Size', value: formatSizeBytes(metadata.size_bytes) },
  ]
}

export function inferredFieldsFromInspection(inspection: CheckpointInspection): InferredField[] {
  return inferredFields(inspection)
}

// The checkpoint-detail counterpart of inferredFieldsFromInspection --
// same nine fields, read from the stored CheckpointInferredMetadata
// (app/schemas/checkpoints.py) instead of a fresh inspection, for
// ModelConfigTab's "What the checkpoint says" section.
export function inferredFieldsFromCheckpoint(inferred: CheckpointInferredMetadata): InferredField[] {
  return inferredFields(inferred)
}
