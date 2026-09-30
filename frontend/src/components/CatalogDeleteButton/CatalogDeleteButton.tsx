import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteCatalogRow } from '../../api/queries/catalog'
import type { CatalogResourceDescriptor } from '../../utils/catalogResources'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { IconButton } from '../IconButton/IconButton'

interface CatalogDeleteButtonProps {
  resource: CatalogResourceDescriptor
  rowId: number
  name: string
  // Disabled when false -- catalog-status' own row already carries why
  // (its `detail` text, rendered as this row's own Detail column), so
  // this button doesn't repeat that reasoning itself.
  deletable: boolean
}

// Delete's own confirmation (ground rule 14: never window.confirm),
// following the RunCancelButton pattern (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12). Keeps the pre-Phase-12 wording
// exactly: "Delete {noun} {name}? Catalog rows are immutable; this
// cannot be undone."
export function CatalogDeleteButton({ resource, rowId, name, deletable }: CatalogDeleteButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const deleteCatalogRow = useDeleteCatalogRow(resource)

  function handleConfirm(): void {
    deleteCatalogRow.mutate(rowId, {
      onSuccess: () => {
        setConfirmOpen(false)
        toast.success(`Deleted ${resource.noun} ${name}`)
      },
      onError: (error) => {
        toast.error(`Could not delete ${name}: ${String(error)}`)
      },
    })
  }

  return (
    <>
      <IconButton
        aria-label={`Delete ${name}`}
        variant="danger"
        size="sm"
        disabled={!deletable}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </IconButton>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${resource.noun} ${name}?`}
        description="Catalog rows are immutable; this cannot be undone."
        confirmLabel="Delete"
        destructive
        confirming={deleteCatalogRow.isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
