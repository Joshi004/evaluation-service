import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { IconButton } from '../IconButton/IconButton'
import { copyToClipboard } from '../../utils/copyToClipboard'

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
}

// Copies `value` to the clipboard, flips its own icon to a checkmark
// for a beat, and confirms with a toast -- the one way any detail page
// offers to copy a full id, path or hash.
export function CopyButton({ value, label = 'Copy', className }: CopyButtonProps) {
  const [justCopied, setJustCopied] = useState(false)

  async function handleClick(): Promise<void> {
    const succeeded = await copyToClipboard(value)
    if (!succeeded) {
      toast.error('Could not copy to clipboard')
      return
    }
    setJustCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setJustCopied(false), 1500)
  }

  return (
    <IconButton variant="ghost" size="sm" aria-label={label} className={className} onClick={handleClick}>
      {justCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </IconButton>
  )
}
