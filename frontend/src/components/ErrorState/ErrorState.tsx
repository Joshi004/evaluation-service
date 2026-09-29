import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../Button/Button'

interface ErrorStateProps {
  message: string
  details?: string
  onRetry?: () => void
}

// The one way a data-driven view reports a load failure (§4.5): a
// plain message, a Retry action when the caller can re-run the
// request, and the raw error tucked behind a disclosure instead of
// dumped inline.
export function ErrorState({ message, details, onRetry }: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card p-6 text-center">
      <AlertTriangle className="mx-auto h-5 w-5 text-danger" />
      <p className="mt-2 text-sm text-foreground">{message}</p>
      <div className="mt-3 flex items-center justify-center gap-3">
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        )}
        {details && (
          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {showDetails ? 'Hide details' : 'Details'}
          </button>
        )}
      </div>
      {showDetails && details && (
        <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
          {details}
        </pre>
      )}
    </div>
  )
}
