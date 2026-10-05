// Non-DOM logic for ChatPage.tsx: the conversation shape persisted to
// localStorage, reading/writing it, and useChatConversation -- the one
// hook that owns sending, stopping, regenerating, clearing, and
// updating settings for one model's conversation. Kept out of the
// component body per .cursor/rules/frontend-components.mdc.
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  type ChatMessage,
  type ChatRole,
  type ChatSamplingSettings,
  type ChatStreamEvent,
  type CheckpointListItem,
  type EndpointListItem,
  type SamplingProfileSummary,
} from '../api/client'
import { streamChatReply } from '../api/chatStream'
import { describeError } from '../utils/describeError'

// One message in a conversation. There is no `system` role here --
// mirrors app/schemas/endpoints.py's own ChatMessage; the system
// prompt is ChatConversation.systemPrompt instead, set at most once
// per request. `status` is `'streaming'` only ever transiently: a send
// writes the conversation to storage immediately (so a crash mid-reply
// doesn't lose the question that was asked), but a message is only
// ever written in that state at the instant a reply starts -- never
// per token (see `useChatConversation`'s own module comments) -- and
// `normalizeAfterLoad` below converts any dangling `'streaming'` row
// found on the next load into `'stopped'`, since there is no live
// request left to resume it.
export interface ChatConversationMessage {
  id: string
  role: ChatRole
  content: string
  // Only ever set for an assistant message from a server with a
  // reasoning parser configured -- null for every user message and
  // for an assistant message from a plain server (no separate
  // reasoning field at all; see app/services/endpoints/chat.py's own
  // module docstring).
  reasoning: string | null
  status: 'streaming' | 'complete' | 'stopped' | 'error'
  // vLLM's own finish_reason verbatim -- only ever set once status is
  // 'complete'.
  finishReason: string | null
  promptTokens: number | null
  completionTokens: number | null
  // Only set once status is 'error'.
  errorMessage: string | null
  createdAt: string
  // Set once the reply settles (complete, stopped or error) -- null
  // while still streaming. ChatMessageBubble subtracts this from
  // createdAt for the "each reply also shows ... its duration"
  // requirement, rather than a live-ticking timer: a manual check
  // cares how long the finished reply took, not a running clock.
  completedAt: string | null
}

export interface ChatConversation {
  messages: ChatConversationMessage[]
  systemPrompt: string | null
  settings: ChatSamplingSettings
  // Which catalog sampling profile `settings` currently matches, if
  // any -- null once a field has been hand-edited away from every
  // known profile. ChatSettingsPanel's own "Reset to profile" and its
  // profile picker both need this to know what's currently selected.
  samplingProfileId: number | null
  updatedAt: string
}

const CHAT_STORAGE_KEY = 'evalsvc.chat.v1'

// Matches app/schemas/endpoints.py's own ChatRequest.messages bound --
// a conversation long enough to hit this would 422 on the backend
// otherwise, so the request is built from the most recent messages
// only, the same "recent window" a human would re-read anyway.
const MAX_REQUEST_MESSAGES = 200

type ChatStorageV1 = Record<string, ChatConversation>

function isChatRole(value: unknown): value is ChatRole {
  return value === 'user' || value === 'assistant'
}

function isMessageStatus(value: unknown): value is ChatConversationMessage['status'] {
  return value === 'streaming' || value === 'complete' || value === 'stopped' || value === 'error'
}

function isChatConversationMessage(value: unknown): value is ChatConversationMessage {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    isChatRole(record.role) &&
    typeof record.content === 'string' &&
    (record.reasoning === null || typeof record.reasoning === 'string') &&
    isMessageStatus(record.status) &&
    (record.finishReason === null || typeof record.finishReason === 'string') &&
    (record.promptTokens === null || typeof record.promptTokens === 'number') &&
    (record.completionTokens === null || typeof record.completionTokens === 'number') &&
    (record.errorMessage === null || typeof record.errorMessage === 'string') &&
    typeof record.createdAt === 'string' &&
    (record.completedAt === null || typeof record.completedAt === 'string')
  )
}

function isChatSamplingSettings(value: unknown): value is ChatSamplingSettings {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.temperature === 'number' &&
    typeof record.top_p === 'number' &&
    typeof record.top_k === 'number' &&
    typeof record.presence_penalty === 'number' &&
    typeof record.repetition_penalty === 'number' &&
    typeof record.max_tokens === 'number' &&
    typeof record.enable_thinking === 'boolean' &&
    (record.seed === null || typeof record.seed === 'number')
  )
}

function isChatConversation(value: unknown): value is ChatConversation {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.messages) &&
    record.messages.every(isChatConversationMessage) &&
    (record.systemPrompt === null || typeof record.systemPrompt === 'string') &&
    isChatSamplingSettings(record.settings) &&
    (record.samplingProfileId === null || typeof record.samplingProfileId === 'number') &&
    typeof record.updatedAt === 'string'
  )
}

function isChatStorageV1(value: unknown): value is ChatStorageV1 {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Object.values(value as Record<string, unknown>).every(isChatConversation)
}

// Both read/write below swallow storage errors (disabled storage, a
// full quota, corrupted JSON) the same way useLocalStorageState.ts and
// CompareTrayProvider.helper.ts already do -- a cache miss or a failed
// write costs history, not correctness.
function readChatStorage(): ChatStorageV1 {
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)
    if (raw === null) {
      return {}
    }
    const parsed: unknown = JSON.parse(raw)
    return isChatStorageV1(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeChatStorage(storage: ChatStorageV1): boolean {
  try {
    // Removes the key entirely once nothing is left, rather than
    // storing "{}" -- mirrors CompareTrayProvider.helper.ts's own
    // "empty tray leaves nothing in devtools' storage panel" rule.
    if (Object.keys(storage).length === 0) {
      window.localStorage.removeItem(CHAT_STORAGE_KEY)
      return true
    }
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(storage))
    return true
  } catch {
    return false
  }
}

// A message still marked 'streaming' on load means the tab closed or
// crashed mid-reply in an earlier session -- there is no live request
// left to resume, so it reads the same as if Stop had been pressed the
// instant that session ended.
function normalizeAfterLoad(conversation: ChatConversation): ChatConversation {
  const hasDanglingStream = conversation.messages.some((message) => message.status === 'streaming')
  if (!hasDanglingStream) {
    return conversation
  }
  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.status === 'streaming' ? { ...message, status: 'stopped' } : message,
    ),
  }
}

function readConversation(checkpointId: number): ChatConversation | null {
  const conversation = readChatStorage()[String(checkpointId)]
  return conversation === undefined ? null : normalizeAfterLoad(conversation)
}

function writeConversation(checkpointId: number, conversation: ChatConversation): boolean {
  const storage = readChatStorage()
  storage[String(checkpointId)] = conversation
  return writeChatStorage(storage)
}

// The /chat list page's own "has history" check -- a conversation
// cleared down to zero messages (ChatConversation.messages.length ===
// 0) still has a storage entry (its settings/system prompt are kept),
// so this filters on message count rather than entry presence.
export function listSavedConversationCheckpointIds(): number[] {
  return Object.entries(readChatStorage())
    .filter(([, conversation]) => conversation.messages.length > 0)
    .map(([checkpointId]) => Number(checkpointId))
}

// The list page's own "Clear all chat history" button, and the
// conversation header's own (see useChatConversation's clearAllHistory,
// which also resets its own in-memory state after calling this).
export function clearAllConversations(): boolean {
  return writeChatStorage({})
}

export interface ChatModelRow {
  checkpoint: CheckpointListItem
  liveEndpointCount: number
}

// /chat's own list: every checkpoint with at least one live server,
// plus every checkpoint with saved history but no live server right
// now -- shown as "no server running", per the plan, rather than
// dropped, since the conversation is still there to review. A
// checkpoint with neither is left off entirely: there is nothing to
// chat with or look back at. listSavedConversationCheckpointIds() is
// checked against the current catalog here, not trusted on its own --
// a checkpoint can be deleted from the database while its old
// localStorage entry lingers.
export function buildChatModelRows(checkpoints: CheckpointListItem[], liveEndpoints: EndpointListItem[]): ChatModelRow[] {
  const liveEndpointCountByCheckpointId = new Map<number, number>()
  for (const endpoint of liveEndpoints) {
    liveEndpointCountByCheckpointId.set(
      endpoint.checkpoint_id,
      (liveEndpointCountByCheckpointId.get(endpoint.checkpoint_id) ?? 0) + 1,
    )
  }
  const savedHistoryCheckpointIds = new Set(listSavedConversationCheckpointIds())

  return checkpoints
    .filter(
      (checkpoint) => liveEndpointCountByCheckpointId.has(checkpoint.id) || savedHistoryCheckpointIds.has(checkpoint.id),
    )
    .map((checkpoint) => ({
      checkpoint,
      liveEndpointCount: liveEndpointCountByCheckpointId.get(checkpoint.id) ?? 0,
    }))
    .sort((a, b) => {
      // Models you can talk to right now first, alphabetical within
      // each group.
      const aIsLive = a.liveEndpointCount > 0
      const bIsLive = b.liveEndpointCount > 0
      if (aIsLive !== bIsLive) {
        return aIsLive ? -1 : 1
      }
      return a.checkpoint.name.localeCompare(b.checkpoint.name)
    })
}

// A model's own default sampling profile, translated into the chat
// settings shape -- mirrors app.services.harness.task_config's own
// generation_config exactly, minus min_p (decision D4). `seed: null`,
// not the profile's own pinned value: an eval run's reproducibility
// requirement is not something a manual chat needs, and Regenerate
// relies on a fresh draw each time.
export function chatSettingsFromSamplingProfile(profile: SamplingProfileSummary): ChatSamplingSettings {
  return {
    temperature: profile.temperature,
    top_p: profile.top_p,
    top_k: profile.top_k,
    presence_penalty: profile.presence_penalty,
    repetition_penalty: profile.repetition_penalty,
    max_tokens: profile.max_tokens,
    enable_thinking: profile.enable_thinking,
    seed: null,
  }
}

function initialConversation(defaultSamplingProfile: SamplingProfileSummary): ChatConversation {
  return {
    messages: [],
    systemPrompt: null,
    settings: chatSettingsFromSamplingProfile(defaultSamplingProfile),
    samplingProfileId: defaultSamplingProfile.id,
    updatedAt: new Date().toISOString(),
  }
}

function generateMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Only reached in an environment with no Web Crypto (not a real
  // browser) -- good enough for a client-only list key, never sent
  // anywhere that needs real uniqueness guarantees.
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createMessage(
  role: ChatRole,
  content: string,
  status: ChatConversationMessage['status'],
): ChatConversationMessage {
  return {
    id: generateMessageId(),
    role,
    content,
    reasoning: null,
    status,
    finishReason: null,
    promptTokens: null,
    completionTokens: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  }
}

function toBackendMessages(messages: ChatConversationMessage[]): ChatMessage[] {
  return messages.slice(-MAX_REQUEST_MESSAGES).map((message) => ({ role: message.role, content: message.content }))
}

// Text still arriving for whichever message is mid-reply -- kept out
// of `ChatConversation` on purpose (see useChatConversation's own
// module comment): this updates on every animation-frame flush, and
// only `ChatConversation` is what the storage-sync effect below
// persists.
interface StreamingText {
  messageId: string
  content: string
  reasoning: string
}

export interface UseChatConversationResult {
  messages: ChatConversationMessage[]
  systemPrompt: string | null
  settings: ChatSamplingSettings
  samplingProfileId: number | null
  isStreaming: boolean
  sendMessage: (content: string) => void
  stopStreaming: () => void
  regenerate: () => void
  clearConversation: () => void
  clearAllHistory: () => void
  updateSystemPrompt: (value: string | null) => void
  updateSettings: (settings: ChatSamplingSettings, samplingProfileId: number | null) => void
}

// Owns one model's conversation: the persisted state (ChatConversation,
// synced to localStorage on every settled change), the in-flight
// stream's own live text (StreamingText, never persisted directly --
// see that interface's own comment), and every action the chat page
// exposes. `defaultSamplingProfile` must already be loaded by the time
// this is called -- the caller (ChatPage.tsx) only mounts the
// conversation view once its own queries have resolved, the same
// "wait for every query, then render" rule ModelDetailPage.tsx already
// follows, so there is no reactive "settings arrived later" case to
// handle here.
//
// Callers switching `checkpointId` must render whatever mounts this
// hook with `key={checkpointId}` -- the same reason LogStream.tsx's own
// docstring requires a `key` on `source`: otherwise React would reuse
// this instance's state (and its in-flight AbortController) across two
// different models' conversations.
export function useChatConversation(
  checkpointId: number,
  defaultSamplingProfile: SamplingProfileSummary,
  liveEndpoint: EndpointListItem | null,
): UseChatConversationResult {
  const [conversation, setConversation] = useState<ChatConversation>(
    () => readConversation(checkpointId) ?? initialConversation(defaultSamplingProfile),
  )
  const [streamingText, setStreamingText] = useState<StreamingText | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // The one place this conversation is written to storage -- every
  // action below only ever calls `setConversation`, never
  // `writeConversation` directly, so there is exactly one write path
  // to keep "saved at message boundaries, never per token" true. This
  // fires on mount too (writing back what was just read, a harmless
  // no-op byte-for-byte), the same as CompareTrayProvider's own
  // sessionStorage effect. A failed write (a full quota, storage
  // disabled) surfaces as a toast, per the plan -- the conversation
  // itself stays correct in memory either way.
  useEffect(() => {
    if (!writeConversation(checkpointId, conversation)) {
      toast.error('Could not save chat history -- storage may be full. The conversation stays in memory for now.')
    }
  }, [checkpointId, conversation])

  // Stops an in-flight reply if this hook's own instance unmounts --
  // leaving the page (or switching models, given the `key` requirement
  // above) mid-stream stops the reply rather than leaving an abandoned
  // request running against a shared GPU.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const displayMessages = useMemo<ChatConversationMessage[]>(() => {
    if (streamingText === null) {
      return conversation.messages
    }
    return conversation.messages.map((message) =>
      message.id === streamingText.messageId
        ? {
            ...message,
            content: streamingText.content,
            reasoning: streamingText.reasoning === '' ? null : streamingText.reasoning,
          }
        : message,
    )
  }, [conversation.messages, streamingText])

  function runStream(
    requestMessages: ChatMessage[],
    assistantMessageId: string,
    endpointId: number,
    systemPrompt: string | null,
    settings: ChatSamplingSettings,
  ): void {
    const controller = new AbortController()
    abortControllerRef.current = controller
    setStreamingText({ messageId: assistantMessageId, content: '', reasoning: '' })

    // Buffered outside React state and flushed at most once per
    // animation frame -- a fast stream can deliver a token every few
    // milliseconds, and re-rendering on every single one would cost
    // far more than the network itself does.
    let pendingContent = ''
    let pendingReasoning = ''
    let flushScheduled = false

    function flushPendingText(): void {
      if (pendingContent === '' && pendingReasoning === '') {
        return
      }
      const contentDelta = pendingContent
      const reasoningDelta = pendingReasoning
      pendingContent = ''
      pendingReasoning = ''
      setStreamingText((current) =>
        current === null
          ? current
          : {
              ...current,
              content: current.content + contentDelta,
              reasoning: current.reasoning + reasoningDelta,
            },
      )
    }

    function scheduleFlush(): void {
      if (flushScheduled) {
        return
      }
      flushScheduled = true
      requestAnimationFrame(() => {
        flushScheduled = false
        flushPendingText()
      })
    }

    // Folds whatever text is still buffered into the persisted
    // ChatConversation and clears the live streaming state -- the
    // single settle point every terminal case below (done, error,
    // stop) funnels through, so a message is finalized exactly once.
    // Guarded on `abortControllerRef.current` so a stray second call
    // (there should never be one) is a no-op rather than a double
    // write.
    function settleMessage(
      update: Pick<
        ChatConversationMessage,
        'status' | 'finishReason' | 'promptTokens' | 'completionTokens' | 'errorMessage'
      >,
    ): void {
      if (abortControllerRef.current === null) {
        return
      }
      flushPendingText()
      setStreamingText((current) => {
        const finalContent = current?.content ?? ''
        const finalReasoning = current?.reasoning ?? ''
        setConversation((previous) => ({
          ...previous,
          messages: previous.messages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: finalContent,
                  reasoning: finalReasoning === '' ? null : finalReasoning,
                  ...update,
                  completedAt: new Date().toISOString(),
                }
              : message,
          ),
          updatedAt: new Date().toISOString(),
        }))
        return null
      })
      abortControllerRef.current = null
    }

    void streamChatReply(
      endpointId,
      { system_prompt: systemPrompt, messages: requestMessages, settings },
      controller.signal,
      (event: ChatStreamEvent) => {
        switch (event.type) {
          case 'reasoning':
            pendingReasoning += event.delta
            scheduleFlush()
            break
          case 'content':
            pendingContent += event.delta
            scheduleFlush()
            break
          case 'done':
            settleMessage({
              status: 'complete',
              finishReason: event.finish_reason,
              promptTokens: event.prompt_tokens,
              completionTokens: event.completion_tokens,
              errorMessage: null,
            })
            break
          case 'error':
            settleMessage({
              status: 'error',
              finishReason: null,
              promptTokens: null,
              completionTokens: null,
              errorMessage: event.message,
            })
            break
        }
      },
    ).catch((error: unknown) => {
      // An aborted fetch (Stop, or this hook unmounting) rejects
      // rather than ever delivering a 'done'/'error' event -- every
      // other failure (a dropped connection, a non-OK initial
      // response) also lands here, since streamChatReply throws for
      // those instead of emitting an event for them.
      if (error instanceof DOMException && error.name === 'AbortError') {
        settleMessage({
          status: 'stopped',
          finishReason: null,
          promptTokens: null,
          completionTokens: null,
          errorMessage: null,
        })
        return
      }
      settleMessage({
        status: 'error',
        finishReason: null,
        promptTokens: null,
        completionTokens: null,
        errorMessage: describeError(error),
      })
    })
  }

  function sendMessage(content: string): void {
    const trimmed = content.trim()
    if (trimmed === '' || streamingText !== null || liveEndpoint === null) {
      return
    }
    const userMessage = createMessage('user', trimmed, 'complete')
    const assistantMessage = createMessage('assistant', '', 'streaming')
    const requestMessages = toBackendMessages([...conversation.messages, userMessage])

    setConversation((previous) => ({
      ...previous,
      messages: [...previous.messages, userMessage, assistantMessage],
      updatedAt: new Date().toISOString(),
    }))

    runStream(requestMessages, assistantMessage.id, liveEndpoint.id, conversation.systemPrompt, conversation.settings)
  }

  function stopStreaming(): void {
    abortControllerRef.current?.abort()
  }

  function regenerate(): void {
    if (streamingText !== null || liveEndpoint === null || conversation.messages.length === 0) {
      return
    }
    const lastMessage = conversation.messages[conversation.messages.length - 1]
    if (lastMessage.role !== 'assistant') {
      return
    }
    const messagesWithoutLastReply = conversation.messages.slice(0, -1)
    const newAssistantMessage = createMessage('assistant', '', 'streaming')
    const requestMessages = toBackendMessages(messagesWithoutLastReply)

    setConversation((previous) => ({
      ...previous,
      messages: [...messagesWithoutLastReply, newAssistantMessage],
      updatedAt: new Date().toISOString(),
    }))

    runStream(
      requestMessages,
      newAssistantMessage.id,
      liveEndpoint.id,
      conversation.systemPrompt,
      conversation.settings,
    )
  }

  // This model's own "Clear conversation" -- empties the message list
  // but keeps the tuned settings and system prompt, so clearing history
  // to start fresh doesn't also undo a deliberate sampling tweak.
  function clearConversation(): void {
    abortControllerRef.current?.abort()
    setStreamingText(null)
    setConversation((previous) => ({ ...previous, messages: [], updatedAt: new Date().toISOString() }))
  }

  // The header's own "Clear all chat history" -- wipes every model's
  // storage entry (clearAllConversations above) and resets this one's
  // in-memory state to match, so a conversation left open doesn't
  // silently reappear and get rewritten right back to storage by the
  // sync effect above.
  function clearAllHistory(): void {
    abortControllerRef.current?.abort()
    setStreamingText(null)
    clearAllConversations()
    setConversation(initialConversation(defaultSamplingProfile))
  }

  function updateSystemPrompt(value: string | null): void {
    setConversation((previous) => ({ ...previous, systemPrompt: value, updatedAt: new Date().toISOString() }))
  }

  function updateSettings(settings: ChatSamplingSettings, samplingProfileId: number | null): void {
    setConversation((previous) => ({ ...previous, settings, samplingProfileId, updatedAt: new Date().toISOString() }))
  }

  return {
    messages: displayMessages,
    systemPrompt: conversation.systemPrompt,
    settings: conversation.settings,
    samplingProfileId: conversation.samplingProfileId,
    isStreaming: streamingText !== null,
    sendMessage,
    stopStreaming,
    regenerate,
    clearConversation,
    clearAllHistory,
    updateSystemPrompt,
    updateSettings,
  }
}
