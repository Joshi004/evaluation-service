import { cn } from '../../utils/cn'
import { CopyButton } from '../CopyButton/CopyButton'

interface CodeBlockProps {
  value: string
  copyLabel?: string
  className?: string
}

// Verbatim text with a copy button, capped to a scrollable max height
// -- the shared shell behind JsonDetails' own collapsible JSON view
// and the Benchmark detail page's own prompt-template and source-YAML
// displays (Phase 12, docs/UI_REDESIGN_PLAN.md §8.12), so "here is the
// raw text, exactly as stored" renders one way everywhere instead of
// each caller hand-rolling its own <pre>+CopyButton pair the way
// JsonDetails and StandardsPage.tsx's own Source YAML <details> used
// to, separately.
export function CodeBlock({ value, copyLabel = 'Copy', className }: CodeBlockProps) {
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <pre className="max-h-64 flex-1 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
        {value}
      </pre>
      <CopyButton value={value} label={copyLabel} />
    </div>
  )
}
