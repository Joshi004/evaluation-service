import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { textInputClassName } from './TextInput.helper'

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

// The one text-entry primitive. SearchInput reuses its class-building
// logic (not the rendered element itself, since it needs different
// horizontal padding for its icon and clear button) rather than
// duplicating the base styling.
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { invalid = false, className, ...rest },
  ref,
) {
  return <input ref={ref} className={textInputClassName({ invalid, className })} {...rest} />
})
