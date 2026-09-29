import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import {
  BUTTON_ICON_SIZE,
  buttonClassName,
  type ButtonSize,
  type ButtonVariant,
} from '../Button/Button.helper'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  'aria-label': string
  children: ReactNode
}

// A Button with no visible label -- just an icon -- so it must carry
// its own accessible name; aria-label is a required prop rather than
// optional, so it can't be left off by accident.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={buttonClassName(variant, BUTTON_ICON_SIZE[size], className)}
      {...rest}
    >
      {children}
    </button>
  )
})
