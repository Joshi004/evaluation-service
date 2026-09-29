import { CopyButton } from '../CopyButton/CopyButton'
import { Tooltip } from '../Tooltip/Tooltip'
import { shortFingerprint } from '../../utils/shortFingerprint'
import { cn } from '../../utils/cn'

interface FingerprintChipProps {
  hash: string
  label?: string
  className?: string
}

// §4.3's "Fingerprint": a content hash shown as 8 monospace characters
// with the full value in a tooltip and a copy button, never the raw
// hash as the primary label. Callers that have a human label (a
// standard's name, a profile's label) pass it through `label`; an
// ad-hoc row with none renders the fingerprint alone.
export function FingerprintChip({ hash, label, className }: FingerprintChipProps) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {label && <span className="text-sm text-foreground">{label}</span>}
      <Tooltip content={hash}>
        <span tabIndex={0} className="font-mono text-xs text-muted-foreground">
          {shortFingerprint(hash)}
        </span>
      </Tooltip>
      <CopyButton value={hash} label="Copy fingerprint" />
    </span>
  )
}
