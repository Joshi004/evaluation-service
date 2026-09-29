import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface KeyValueRow {
  label: ReactNode
  value: ReactNode
}

interface KeyValueListProps {
  rows: KeyValueRow[]
  className?: string
}

// A label/value grid -- run metadata, checkpoint details, anywhere a
// page needs a plain "field: value" list rather than a table.
export function KeyValueList({ rows, className }: KeyValueListProps) {
  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm', className)}>
      {rows.map((row, index) => (
        // A <div> grouping one dt/dd pair is valid directly inside a
        // <dl> (HTML5); `contents` keeps it out of the grid so the dt
        // and dd still land in the two columns above as if it weren't
        // there.
        <div key={index} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
