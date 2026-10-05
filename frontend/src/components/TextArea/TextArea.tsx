import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import { textAreaClassName } from './TextArea.helper'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

// The multi-line sibling of TextInput -- a system prompt, a chat
// message, anywhere free text needs more than one line. Plain
// vertical resize (the browser's own drag handle) rather than an
// auto-growing height: measuring scrollHeight on every keystroke is
// more machinery than a manual chat box needs.
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { invalid = false, className, ...rest },
  ref,
) {
  return <textarea ref={ref} {...rest} aria-invalid={invalid} className={textAreaClassName({ invalid, className })} />
})
