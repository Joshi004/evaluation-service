import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { RunListItem } from '../../api/client'
import { classifyRunError } from '../../utils/classifyRunError'
import { paths } from '../../utils/paths'
import { CopyButton } from '../CopyButton/CopyButton'
import { Popover } from '../Popover/Popover'

interface RunFailureReasonProps {
  run: RunListItem
}

// The Runs table's own compact failure cell (`"..." > details`) --
// classifyRunError's plain-language title inline, with its hint, the
// raw error and an Open logs link tucked behind a popover.
// RunFailurePanel is this same classification's fuller, full-page
// version; a list row only has room for one line plus a disclosure.
export function RunFailureReason({ run }: RunFailureReasonProps) {
  const classification = classifyRunError(run.error)

  if (classification === null) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  return (
    <div className="space-y-0.5">
      <p className="text-sm text-danger">{classification.title}</p>
      <Popover
        trigger={
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            Details
          </button>
        }
      >
        <div className="w-72 space-y-2">
          {classification.hint && <p className="text-muted-foreground">{classification.hint}</p>}
          <div className="flex items-start gap-2">
            <pre className="flex-1 overflow-x-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap text-muted-foreground">
              {classification.raw}
            </pre>
            <CopyButton value={classification.raw} label="Copy raw error" />
          </div>
          <Link to={paths.runLogs(run.id)} className="text-xs font-medium text-primary hover:underline">
            Open logs →
          </Link>
        </div>
      </Popover>
    </div>
  )
}
