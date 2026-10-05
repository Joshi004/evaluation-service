import type { ChatConversationMessage } from '../../pages/ChatPage.helper'
import { CHAT_FINISH_REASON_LABELS, TERM_HINTS } from '../../utils/labels'
import { formatDuration } from '../../utils/formatDuration'

export interface ChatFinishReasonNote {
  label: string
  hint: string
}

// Only 'length' gets a note -- a normal 'stop' and every other vLLM
// finish_reason stay silent, since the plan only calls out truncation
// specifically (the same failure mode an eval run's own
// truncation_rate already names). Reuses TERM_HINTS.truncated rather
// than a second hint sentence for the same concept.
export function chatFinishReasonNote(finishReason: string | null): ChatFinishReasonNote | null {
  if (finishReason !== 'length') {
    return null
  }
  return { label: CHAT_FINISH_REASON_LABELS.length, hint: TERM_HINTS.truncated }
}

// null while still streaming -- there is no end time to measure
// against yet, and this is a finished-reply summary, not a live timer
// (see ChatConversationMessage.completedAt's own comment).
export function chatMessageDuration(message: ChatConversationMessage): string | null {
  if (message.completedAt === null) {
    return null
  }
  return formatDuration(message.createdAt, message.completedAt, new Date())
}

// "128 \u2192 340 tokens" -- null if neither count ever arrived (every
// settle that isn't a clean 'done': stopped, error), so the footer
// never shows a meaningless "? \u2192 ? tokens".
export function chatTokenUsage(message: ChatConversationMessage): string | null {
  if (message.promptTokens === null && message.completionTokens === null) {
    return null
  }
  const promptText = message.promptTokens ?? '?'
  const completionText = message.completionTokens ?? '?'
  return `${promptText} \u2192 ${completionText} tokens`
}
