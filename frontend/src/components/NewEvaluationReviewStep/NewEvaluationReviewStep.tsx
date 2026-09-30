import type { CreatedItem } from '../DryRunPreview/DryRunPreview.helper'
import { Disclosure } from '../Disclosure/Disclosure'
import { DryRunPreview } from '../DryRunPreview/DryRunPreview'
import { PartitionPicker } from '../PartitionPicker/PartitionPicker'
import { TextInput } from '../TextInput/TextInput'
import type { RunPreview } from '../../api/client'

interface NewEvaluationReviewStepProps {
  preview: RunPreview | undefined
  isPreviewLoading: boolean
  isPreviewError: boolean
  previewError: unknown
  onRetryPreview: () => void
  createdItems: CreatedItem[]
  batchName: string
  onBatchNameChange: (name: string) => void
  // null when the current name is fine to submit -- shown under the
  // field the same way any other inline form-validation message would
  // be.
  batchNameError: string | null
  submittedBy: string
  onSubmittedByChange: (value: string) => void
  partition: string | null
  onPartitionChange: (value: string | null) => void
}

// Step 3 of New evaluation: problems and warnings, a compact list of
// what will be minted, the batch's own name and submitter, and the
// cluster partition tucked
// under Advanced since changing it can't change what gets measured.
// This step is itself the confirmation for a costly action -- no extra
// ConfirmDialog on top of it; NewEvaluationSummaryBar's own "Run
// evaluation" button is what actually submits.
export function NewEvaluationReviewStep({
  preview,
  isPreviewLoading,
  isPreviewError,
  previewError,
  onRetryPreview,
  createdItems,
  batchName,
  onBatchNameChange,
  batchNameError,
  submittedBy,
  onSubmittedByChange,
  partition,
  onPartitionChange,
}: NewEvaluationReviewStepProps) {
  return (
    <div className="space-y-6">
      <DryRunPreview
        preview={preview}
        isLoading={isPreviewLoading}
        isError={isPreviewError}
        error={previewError}
        onRetry={onRetryPreview}
        createdItems={createdItems}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-muted-foreground">Batch name</span>
          <TextInput
            value={batchName}
            onChange={(event) => onBatchNameChange(event.target.value)}
            invalid={batchNameError !== null}
            aria-describedby={batchNameError ? 'batch-name-error' : undefined}
            className="mt-1"
          />
          {batchNameError && (
            <p id="batch-name-error" className="mt-1 text-xs text-danger">
              {batchNameError}
            </p>
          )}
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Submitted by (optional)</span>
          <TextInput
            value={submittedBy}
            onChange={(event) => onSubmittedByChange(event.target.value)}
            className="mt-1"
          />
        </label>
      </div>

      <Disclosure summary="Advanced" size="md">
        <div className="mt-3 max-w-xs">
          <PartitionPicker value={partition} onValueChange={onPartitionChange} />
        </div>
      </Disclosure>
    </div>
  )
}
