import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode
}

// Table/TableHeaderCell/TableCell replace the table-header class
// string that was hand-copied onto 12 different pages (§2.3) with one
// shared definition. Styling only -- sorting, density and sticky
// columns are each page's own concern (§4.5), not something a shared
// primitive should guess at generically.
export function Table({ className, children, ...rest }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...rest}>
        {children}
      </table>
    </div>
  )
}

export function TableHeaderCell({
  className,
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-b border-border bg-muted px-3 py-2 text-left text-table font-medium text-muted-foreground',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  )
}

export function TableCell({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-border px-3 py-2 text-foreground', className)} {...rest}>
      {children}
    </td>
  )
}
