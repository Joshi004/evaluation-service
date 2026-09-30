import { useCatalogStatus } from '../../api/queries/catalog'
import type { CatalogResourceDescriptor } from '../../utils/catalogResources'
import { Callout } from '../Callout/Callout'
import { ManageCatalogButton } from '../ManageCatalogButton/ManageCatalogButton'
import { summarizeAttention } from './CatalogHealthBanner.helper'

interface CatalogHealthBannerProps {
  resource: CatalogResourceDescriptor
  className?: string
}

// Only new/conflicting/invalid ever surface here (entryNeedsAttention)
// -- ad_hoc and orphaned rows are normal, permanent fixtures (a live
// check found one of each today), so a banner that fired on "not
// literally loaded" would show up on every page load. Renders nothing
// while status is
// loading, on error (a broken banner would be a worse distraction than
// a missing one -- the drawer's own ErrorState covers this case if
// someone opens it), or once nothing needs attention.
export function CatalogHealthBanner({ resource, className }: CatalogHealthBannerProps) {
  const status = useCatalogStatus(resource)
  if (!status.data) {
    return null
  }

  const summary = summarizeAttention(status.data.entries)
  if (!summary) {
    return null
  }

  const title = `${summary.count} catalog file${summary.count === 1 ? '' : 's'} need${summary.count === 1 ? 's' : ''} attention`

  return (
    <Callout tone="warning" className={className} title={title} actions={<ManageCatalogButton resource={resource} label="Review" />}>
      {summary.breakdown}
    </Callout>
  )
}
