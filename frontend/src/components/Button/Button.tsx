import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from '../Spinner/Spinner'
import { BUTTON_LABEL_SIZE, buttonClassName, type ButtonSize, type ButtonVariant } from './Button.helper'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: ReactNode
}

// The one clickable-action primitive: every page composes this (or
// IconButton) instead of hand-styling a <button>. `loading` hides the
// label rather than swapping it out, so the button keeps its width
// and a click doesn't reflow whatever sits next to it.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled ?? loading}
      className={buttonClassName(variant, BUTTON_LABEL_SIZE[size], className)}
      {...rest}
    >
      <span className={loading ? 'invisible' : 'contents'}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </button>
  )
})
