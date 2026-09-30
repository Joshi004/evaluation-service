import { CopyButton } from '../CopyButton/CopyButton'

interface JsonDetailsProps {
  summary: string
  value: Record<string, unknown>
  className?: string
}

// A collapsible, copyable "raw JSON, verbatim" view -- shared by
// InspectionSummary's own config.json disclosure (Phase 2) and a
// model's own Configuration tab (generation_config, the same kind of
// source object), so there is one rendering of "here is the object
// exactly as read" instead of two hand-rolled <details><pre> pairs.
export function JsonDetails({ summary, value, className }: JsonDetailsProps) {
  const text = JSON.stringify(value, null, 2)
  return (
    <details className={className}>
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
        {summary}
      </summary>
      <div className="mt-2 flex items-start gap-2">
        <pre className="max-h-64 flex-1 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
          {text}
        </pre>
        <CopyButton value={text} label={`Copy ${summary}`} />
      </div>
    </details>
  )
}
