import { useState } from 'react'
import { toast } from 'sonner'
import { useReloadCatalog } from '../../api/queries/catalog'
import type { CatalogResourceDescriptor } from '../../utils/catalogResources'
import { Button } from '../Button/Button'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'

interface CatalogReloadButtonProps {
  resource: CatalogResourceDescriptor
}

// Reload's own confirmation (ground rule 14: never window.confirm),
// following the RunCancelButton pattern (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12). Not `destructive` -- reload only
// ever skips unchanged files and adds new rows or refreshes a row's
// own unhashed fields in place (resource.reloadDescription); it never
// removes anything, unlike Prune and Delete below.
export function CatalogReloadButton({ resource }: CatalogReloadButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const reloadCatalog = useReloadCatalog(resource)

  function handleConfirm(): void {
    reloadCatalog.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false)
        toast.success(`Reloaded the ${resource.pluralNoun} catalog`)
      },
      onError: (error) => {
        toast.error(`Could not reload: ${String(error)}`)
      },
    })
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(true)}>
        Reload
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Reload the ${resource.pluralNoun} catalog?`}
        description={resource.reloadDescription}
        confirmLabel="Reload"
        confirming={reloadCatalog.isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
