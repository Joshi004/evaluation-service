import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { textInputClassName } from '../TextInput/TextInput.helper'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void
}

// TextInput's styling with a leading search icon and, once there is a
// value, a trailing clear button -- the shape every filter/search box
// in the app uses.
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onClear, className, ...rest },
  ref,
) {
  const showClear = Boolean(onClear && value)

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
      <input
        ref={ref}
        type="text"
        value={value}
        className={textInputClassName({ paddingClassName: showClear ? 'pl-9 pr-9' : 'pl-9 pr-3' })}
        {...rest}
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 text-subtle-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
})
