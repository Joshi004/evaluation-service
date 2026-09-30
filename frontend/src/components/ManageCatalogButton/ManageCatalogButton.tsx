import { useState } from 'react'
import type { CatalogResourceDescriptor } from '../../utils/catalogResources'
import { Button } from '../Button/Button'
import { CatalogPanel } from '../CatalogPanel/CatalogPanel'
import { SidePanel } from '../SidePanel/SidePanel'

interface ManageCatalogButtonProps {
  resource: CatalogResourceDescriptor
  // CatalogHealthBanner's own action reads "Review" rather than
  // "Manage catalog" -- same button, same drawer, wording that matches
  // the sentence it follows instead of repeating "catalog" twice.
  label?: string
  className?: string
}

// The one entry point into a catalog's admin actions (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12): a secondary button that opens a
// SidePanel hosting CatalogPanel for one resource. Used directly from
// a page's own toolbar/header and again as CatalogHealthBanner's own
// Review action -- both open the exact same drawer.
export function ManageCatalogButton({ resource, label = 'Manage catalog', className }: ManageCatalogButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="secondary" size="sm" className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title={`Manage ${resource.pluralNoun}`}
        description="Reload picks up new or changed files. Prune removes unreferenced custom rows. Delete removes one row that nothing depends on."
      >
        <CatalogPanel resource={resource} />
      </SidePanel>
    </>
  )
}
