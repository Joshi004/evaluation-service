import { useState } from 'react'
import { useRuns } from '../../api/queries/runs'
import { Button } from '../Button/Button'
import { CompareRunPicker } from '../CompareRunPicker/CompareRunPicker'
import { Dialog } from '../Dialog/Dialog'
import { ErrorState } from '../ErrorState/ErrorState'
import { Skeleton } from '../Skeleton/Skeleton'

interface CompareAddRunDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  benchmark: string
  benchmarkDisplayName: string
  excludeRunIds: number[]
  remainingSlots: number
  onConfirm: (runIds: number[]) => void
}

// Adding to an existing comparison, limited to the baseline's own
// benchmark and to whatever slots are left under MAX_COMPARE_RUNS.
// Selection resets every time the dialog opens, so a cancelled add
// never leaks into the next one.
export function CompareAddRunDialog({
  open,
  onOpenChange,
  benchmark,
  benchmarkDisplayName,
  excludeRunIds,
  remainingSlots,
  onConfirm,
}: CompareAddRunDialogProps) {
  const [selectedRunIds, setSelectedRunIds] = useState<number[]>([])
  // Only fetched while the dialog is actually open -- there is no
  // reason to hold a second poll of "done" runs alive just because
  // the button that opens this dialog is on screen.
  const doneRuns = useRuns({ status: 'done', benchmark }, { enabled: open })

  // Resets the selection the moment `open` flips false -> true --
  // adjusted during render (the same one-time-correction pattern
  // AppShell's own drawer-close-on-navigate uses) rather than in an
  // effect, so a cancelled add never leaks into the next one without
  // paying for an extra commit-and-rerender.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSelectedRunIds([])
    }
  }

  function handleToggle(runId: number): void {
    setSelectedRunIds((current) => {
      if (current.includes(runId)) {
        return current.filter((id) => id !== runId)
      }
      if (current.length >= remainingSlots) {
        return current
      }
      return [...current, runId]
    })
  }

  function handleConfirm(): void {
    onConfirm(selectedRunIds)
    onOpenChange(false)
  }

  const candidates = (doneRuns.data ?? []).filter((run) => !excludeRunIds.includes(run.id))

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Add a run · ${benchmarkDisplayName}`}
      description={`Compare needs the same benchmark. You can add up to ${remainingSlots} more run${remainingSlots === 1 ? '' : 's'}.`}
    >
      <div className="space-y-4">
        {doneRuns.isLoading && <Skeleton className="h-64 w-full" />}

        {doneRuns.isError && (
          <ErrorState
            message="Could not load runs"
            details={String(doneRuns.error)}
            onRetry={() => doneRuns.refetch()}
          />
        )}

        {doneRuns.data && (
          <CompareRunPicker
            runs={candidates}
            selectedRunIds={selectedRunIds}
            maxSelectable={remainingSlots}
            labelFirstSelectedAsBaseline={false}
            onToggle={handleToggle}
          />
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={selectedRunIds.length === 0} onClick={handleConfirm}>
            {selectedRunIds.length === 0
              ? 'Add run'
              : `Add ${selectedRunIds.length} run${selectedRunIds.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
