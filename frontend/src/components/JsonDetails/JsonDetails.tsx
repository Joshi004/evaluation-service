import { CodeBlock } from '../CodeBlock/CodeBlock'

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
// Rebuilt on the CodeBlock primitive (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12) once the Benchmark detail page's own
// prompt-template and source-YAML displays needed the same
// <pre>+CopyButton shell for plain text rather than JSON.
export function JsonDetails({ summary, value, className }: JsonDetailsProps) {
  const text = JSON.stringify(value, null, 2)
  return (
    <details className={className}>
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
        {summary}
      </summary>
      <CodeBlock value={text} copyLabel={`Copy ${summary}`} className="mt-2" />
    </details>
  )
}
