import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Send, Square } from 'lucide-react'
import { Button } from '../Button/Button'
import { TextArea } from '../TextArea/TextArea'

interface ChatComposerProps {
  isStreaming: boolean
  // True once there is no live, unexpired server to send to --
  // ChatPage.tsx owns the "why" (no server, expired) and its own
  // "Start a model server" action; this component only needs to know
  // whether typing is currently possible at all.
  disabled: boolean
  disabledPlaceholder?: string
  onSend: (content: string) => void
  onStop: () => void
}

// The message box at the bottom of a conversation. Enter sends,
// Shift+Enter adds a new line -- the one key-binding difference from a
// plain multi-line TextArea, which is why this wraps TextArea rather
// than being used directly. Send becomes Stop for as long as a reply
// is streaming (onStop aborts the request one level up, in
// useChatConversation), so there is always exactly one button and it
// always does the next useful thing.
export function ChatComposer({
  isStreaming,
  disabled,
  disabledPlaceholder = 'Sending is unavailable right now.',
  onSend,
  onStop,
}: ChatComposerProps) {
  const [value, setValue] = useState('')
  const canSend = !disabled && !isStreaming && value.trim() !== ''

  function handleSend(): void {
    if (!canSend) {
      return
    }
    onSend(value)
    setValue('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border bg-background p-3">
      <div className="flex items-end gap-2">
        <TextArea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isStreaming}
          placeholder={disabled ? disabledPlaceholder : 'Type a message\u2026'}
          rows={3}
          className="flex-1 resize-none"
        />
        {isStreaming ? (
          <Button variant="secondary" onClick={onStop}>
            <Square className="h-4 w-4" aria-hidden="true" />
            Stop
          </Button>
        ) : (
          <Button onClick={handleSend} disabled={!canSend}>
            <Send className="h-4 w-4" aria-hidden="true" />
            Send
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-subtle-foreground">Enter to send · Shift+Enter for a new line</p>
    </div>
  )
}
