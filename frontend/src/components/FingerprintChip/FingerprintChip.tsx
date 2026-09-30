import { CopyButton } from '../CopyButton/CopyButton'
import { Tooltip } from '../Tooltip/Tooltip'
import { shortFingerprint } from '../../utils/shortFingerprint'
import { cn } from '../../utils/cn'
import { TERM_HINTS } from '../../utils/labels'

interface FingerprintChipProps {
  hash: string
  label?: string
  className?: string
}

// A content hash shown as 8 monospace characters, never the raw hash
// as the primary label -- the tooltip carries the full value plus
// TERM_HINTS.fingerprint's own explanation, and a copy button covers
// the times someone actually needs the full string. Callers that have
// a human label (a standard's name, a profile's label) pass it through
// `label`; an ad-hoc row with none renders the fingerprint alone.
export function FingerprintChip({ hash, label, className }: FingerprintChipProps) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {label && <span className="text-sm text-foreground">{label}</span>}
      <Tooltip
        content={
          <div className="max-w-xs space-y-1">
            <p className="break-all font-mono">{hash}</p>
            <p className="text-muted-foreground">{TERM_HINTS.fingerprint}</p>
          </div>
        }
      >
        <span tabIndex={0} className="font-mono text-xs text-muted-foreground">
          {shortFingerprint(hash)}
        </span>
      </Tooltip>
      <CopyButton value={hash} label="Copy fingerprint" />
    </span>
  )
}
