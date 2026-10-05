import { RefreshCw } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ChatConversationMessage } from '../../pages/ChatPage.helper'
import { Callout } from '../Callout/Callout'
import { CopyButton } from '../CopyButton/CopyButton'
import { Disclosure } from '../Disclosure/Disclosure'
import { IconButton } from '../IconButton/IconButton'
import { Spinner } from '../Spinner/Spinner'
import { TermLabel } from '../TermLabel/TermLabel'
import { chatFinishReasonNote, chatMessageDuration, chatTokenUsage } from './ChatMessageBubble.helper'

interface ChatMessageBubbleProps {
  message: ChatConversationMessage
  // Only ever passed for the conversation's last assistant message,
  // and only while nothing is actively streaming -- useChatConversation's
  // own regenerate() replaces that one reply, which only makes sense
  // as the most recent turn.
  onRegenerate?: () => void
}

const ROLE_LABELS: Record<ChatConversationMessage['role'], string> = {
  user: 'You',
  assistant: 'Assistant',
}

// One turn of the conversation -- a user question or an assistant
// reply, its own thinking block, and (once settled) its finish-reason,
// token and duration footer. Raw whitespace-pre-wrap text throughout:
// markdown rendering is explicitly out of scope (the plan's own "Out
// of scope" list) -- faithful raw text is what checking the model's
// actual output needs.
export function ChatMessageBubble({ message, onRegenerate }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'
  const finishReason = chatFinishReasonNote(message.finishReason)
  const duration = chatMessageDuration(message)
  const tokenUsage = chatTokenUsage(message)
  const isWaitingForFirstToken =
    message.status === 'streaming' && message.content === '' && message.reasoning === null
  const hasFooter =
    finishReason !== null ||
    tokenUsage !== null ||
    duration !== null ||
    message.content !== '' ||
    onRegenerate !== undefined

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <span className="text-xs text-muted-foreground">{ROLE_LABELS[message.role]}</span>

      <div
        className={cn(
          'max-w-2xl rounded-lg border px-3 py-2',
          isUser ? 'border-primary bg-primary-soft' : 'border-border bg-card',
        )}
      >
        {isWaitingForFirstToken && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner label="Waiting for a reply" className="h-3.5 w-3.5" />
            Thinking…
          </p>
        )}

        {message.reasoning && (
          <Disclosure summary="Thinking" size="sm" className="mb-2">
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{message.reasoning}</p>
          </Disclosure>
        )}

        {message.content && <p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>}

        {message.status === 'error' && (
          <Callout tone="danger" className="mt-2">
            {message.errorMessage ?? 'Something went wrong.'}
          </Callout>
        )}

        {message.status === 'stopped' && <p className="mt-2 text-xs text-muted-foreground">Stopped by request.</p>}
      </div>

      {hasFooter && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {finishReason && <TermLabel hint={finishReason.hint}>{finishReason.label}</TermLabel>}
          {tokenUsage && <span>{tokenUsage}</span>}
          {duration && <span>{duration}</span>}
          {message.content && <CopyButton value={message.content} label="Copy message" />}
          {onRegenerate && (
            <IconButton aria-label="Regenerate this reply" size="sm" onClick={onRegenerate}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </IconButton>
          )}
        </div>
      )}
    </div>
  )
}
