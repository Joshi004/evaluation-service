import { Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../Button/Button'
import { copyToClipboard } from '../../utils/copyToClipboard'

interface CopyLinkButtonProps {
  // Defaults to the current address bar -- every page's "Copy link"
  // action (§4.5's "state lives in the URL") shares this behaviour:
  // whatever filters, sort and tab are already in the URL is exactly
  // what gets copied, with no page reconstructing its own URL string.
  url?: string
  label?: string
  className?: string
}

// Labelled sibling of CopyButton (which is icon-only, for a single
// value like a hash) -- the Leaderboard, a run report and Compare each
// put one of these next to their primary content per §4.5's "Actions"
// pattern.
export function CopyLinkButton({ url, label = 'Copy link', className }: CopyLinkButtonProps) {
  async function handleClick(): Promise<void> {
    const succeeded = await copyToClipboard(url ?? window.location.href)
    if (!succeeded) {
      toast.error('Could not copy the link')
      return
    }
    toast.success('Link copied')
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} className={className}>
      <LinkIcon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  )
}
