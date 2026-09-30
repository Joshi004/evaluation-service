import { useState } from 'react'
import { toast } from 'sonner'
import type { CatalogEntryStatus } from '../../api/client'
import { usePruneCatalog } from '../../api/queries/catalog'
import type { CatalogResourceDescriptor } from '../../utils/catalogResources'
import { Button } from '../Button/Button'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { describePrune, prunableRowIds } from '../CatalogPanel/CatalogPanel.helper'

interface CatalogPruneButtonProps {
  resource: CatalogResourceDescriptor
  entries: CatalogEntryStatus[]
}

// Prune's own confirmation (ground rule 14: never window.confirm),
// following the RunCancelButton pattern (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12). `destructive`: unlike Reload, this
// permanently removes rows. Disabled at zero candidates rather than
// hidden, so "there is nothing to prune right now" stays visible
// rather than the button disappearing without explanation.
export function CatalogPruneButton({ resource, entries }: CatalogPruneButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pruneCatalog = usePruneCatalog(resource)
  const rowIds = prunableRowIds(entries)

  function handleConfirm(): void {
    pruneCatalog.mutate(undefined, {
      onSuccess: (result) => {
        setConfirmOpen(false)
        const removedCount = result.deleted_ids.length
        if (removedCount === 0) {
          toast.info('Nothing was removed -- every candidate had already gained a reference')
        } else {
          toast.success(`Removed ${removedCount} unlabelled ${resource.noun}${removedCount === 1 ? '' : 's'}`)
        }
      },
      onError: (error) => {
        toast.error(`Could not prune: ${String(error)}`)
      },
    })
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={rowIds.length === 0}
        onClick={() => setConfirmOpen(true)}
      >
        {rowIds.length === 0 ? 'Nothing to prune' : `Prune (${rowIds.length})`}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Prune ${rowIds.length} unlabelled ${resource.noun}${rowIds.length === 1 ? '' : 's'}?`}
        description={describePrune(rowIds, resource.noun)}
        confirmLabel="Prune"
        destructive
        confirming={pruneCatalog.isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
