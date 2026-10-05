import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type {
  CheckpointListItem,
  EndpointListItem,
  SamplingProfileSummary,
  ServingProfileSummary,
} from '../../api/client'
import { useChatConversation } from '../../pages/ChatPage.helper'
import { paths } from '../../utils/paths'
import { useNow } from '../../utils/useNow'
import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import { Callout } from '../Callout/Callout'
import { ChatComposer } from '../ChatComposer/ChatComposer'
import { ChatMessageBubble } from '../ChatMessageBubble/ChatMessageBubble'
import { ChatServerPicker } from '../ChatServerPicker/ChatServerPicker'
import { ChatSettingsPanel } from '../ChatSettingsPanel/ChatSettingsPanel'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { ModelName } from '../ModelName/ModelName'
import { PageHeader } from '../PageHeader/PageHeader'
import { TimeToLiveBar } from '../TimeToLiveBar/TimeToLiveBar'

interface ChatConversationProps {
  checkpoint: CheckpointListItem
  defaultSamplingProfile: SamplingProfileSummary
  samplingProfiles: SamplingProfileSummary[]
  servingProfiles: ServingProfileSummary[]
  // Every currently-live endpoint for this one checkpoint -- ChatPage.tsx
  // has already filtered /endpoints down to this model's own rows.
  liveEndpointsForCheckpoint: EndpointListItem[]
  onStartServerClick: () => void
}

const TIME_TO_LIVE_TICK_INTERVAL_MS = 30_000

// One model's whole chat surface: the header (server status, time
// left, a server picker when more than one is live, Settings, Clear
// conversation, Clear all), the message list, and the composer.
// Mounted by ChatPage.tsx with `key={checkpoint.id}`, the same reason
// LogStream.tsx's own docstring requires a `key={source}` -- switching
// models must abort the old model's in-flight stream and start this
// component, and useChatConversation, fresh rather than reusing state
// across two different conversations.
export function ChatConversation({
  checkpoint,
  defaultSamplingProfile,
  samplingProfiles,
  servingProfiles,
  liveEndpointsForCheckpoint,
  onStartServerClick,
}: ChatConversationProps) {
  const [selectedEndpointId, setSelectedEndpointId] = useState<number | null>(null)
  // Self-correcting rather than reset by an effect: if the selected id
  // is no longer among this model's live endpoints (it expired, or
  // this is the first render), this falls back to whichever one is
  // live, or null if none are.
  const liveEndpoint =
    liveEndpointsForCheckpoint.find((endpoint) => endpoint.id === selectedEndpointId) ??
    liveEndpointsForCheckpoint[0] ??
    null

  const {
    messages,
    systemPrompt,
    settings,
    samplingProfileId,
    isStreaming,
    sendMessage,
    stopStreaming,
    regenerate,
    clearConversation,
    clearAllHistory,
    updateSystemPrompt,
    updateSettings,
  } = useChatConversation(checkpoint.id, defaultSamplingProfile, liveEndpoint)

  const now = useNow(TIME_TO_LIVE_TICK_INTERVAL_MS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false)

  // Scrolls to the start of the newest exchange whenever one begins --
  // keyed on the message count, not on every streamed token, so a
  // long reply can be read top-to-bottom (or scrolled away from
  // entirely) without being fought back into view on every animation
  // frame. scrollIntoView walks up to whichever ancestor actually
  // scrolls (AppShell's own <main>), so this needs no ref to it.
  const bottomMarkerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomMarkerRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const servingProfile =
    liveEndpoint === null
      ? null
      : servingProfiles.find((profile) => profile.id === liveEndpoint.serving_profile_id) ?? null

  const lastMessage = messages[messages.length - 1]
  const canRegenerate = !isStreaming && lastMessage !== undefined && lastMessage.role === 'assistant'

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={
          <Link to={paths.chat()} className="hover:underline">
            Chat
          </Link>
        }
        title={<ModelName name={checkpoint.name} family={checkpoint.family} />}
        description={
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              {liveEndpoint ? <Badge tone="success">Serving</Badge> : <Badge tone="neutral">No server running</Badge>}
              <ChatServerPicker
                endpoints={liveEndpointsForCheckpoint}
                selectedEndpointId={liveEndpoint?.id ?? null}
                onSelectedEndpointIdChange={setSelectedEndpointId}
              />
            </div>
            {liveEndpoint && (
              <TimeToLiveBar
                createdAt={liveEndpoint.created_at}
                expiresAt={liveEndpoint.expires_at}
                now={now}
                className="max-w-xs"
              />
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
              Settings
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={messages.length === 0}
              onClick={() => setClearConfirmOpen(true)}
            >
              Clear conversation
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setClearAllConfirmOpen(true)}>
              Clear all chat history
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        {/* Only invites sending when there's actually a server to send
            to -- otherwise the warning Callout below is the one message
            about why this is empty. */}
        {messages.length === 0 && liveEndpoint !== null && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Send a message to start checking this model.
          </p>
        )}
        {messages.map((message, index) => (
          <ChatMessageBubble
            key={message.id}
            message={message}
            onRegenerate={canRegenerate && index === messages.length - 1 ? regenerate : undefined}
          />
        ))}
        {/* scroll-mb leaves room for the sticky composer below, so
            scrollIntoView doesn't park the newest message right behind
            it. */}
        <div ref={bottomMarkerRef} className="scroll-mb-32" />
      </div>

      {liveEndpoint === null && (
        <Callout
          tone="warning"
          actions={
            <Button size="sm" onClick={onStartServerClick}>
              Start a model server
            </Button>
          }
        >
          There's no live server for this model right now. History is saved, and picks back up once one is running
          again.
        </Callout>
      )}

      <div className="sticky bottom-0 border-t border-border bg-background">
        <ChatComposer
          isStreaming={isStreaming}
          disabled={liveEndpoint === null}
          disabledPlaceholder="Start a model server to send a message."
          onSend={sendMessage}
          onStop={stopStreaming}
        />
      </div>

      <ChatSettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        samplingProfileId={samplingProfileId}
        systemPrompt={systemPrompt}
        defaultSamplingProfile={defaultSamplingProfile}
        samplingProfiles={samplingProfiles}
        servingProfile={servingProfile}
        onUpdateSettings={updateSettings}
        onUpdateSystemPrompt={updateSystemPrompt}
      />

      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title="Clear this conversation?"
        description={`Removes every message with ${checkpoint.name} from this browser. Settings and the system prompt stay as they are.`}
        confirmLabel="Clear conversation"
        destructive
        onConfirm={() => {
          clearConversation()
          setClearConfirmOpen(false)
        }}
      />

      <ConfirmDialog
        open={clearAllConfirmOpen}
        onOpenChange={setClearAllConfirmOpen}
        title="Clear all chat history?"
        description="Removes every saved conversation for every model from this browser. This can't be undone."
        confirmLabel="Clear all"
        destructive
        onConfirm={() => {
          clearAllHistory()
          setClearAllConfirmOpen(false)
        }}
      />
    </div>
  )
}
