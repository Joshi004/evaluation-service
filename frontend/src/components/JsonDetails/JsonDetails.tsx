import { CodeBlock } from '../CodeBlock/CodeBlock'
import { Disclosure } from '../Disclosure/Disclosure'

interface JsonDetailsProps {
  summary: string
  value: Record<string, unknown>
  className?: string
}

// A collapsible, copyable "raw JSON, verbatim" view -- shared by
// InspectionSummary's own config.json disclosure and a model's own
// Configuration tab (generation_config, the same kind of source
// object), so there is one rendering of "here is the object exactly as
// read" instead of two hand-rolled Disclosure+CodeBlock pairs. Built on
// the CodeBlock primitive, which the Benchmark detail page's own
// prompt-template and source-YAML displays also use directly for plain
// text rather than JSON.
export function JsonDetails({ summary, value, className }: JsonDetailsProps) {
  const text = JSON.stringify(value, null, 2)
  return (
    <Disclosure summary={summary} size="sm" className={className}>
      <CodeBlock value={text} copyLabel={`Copy ${summary}`} className="mt-2" />
    </Disclosure>
  )
}
