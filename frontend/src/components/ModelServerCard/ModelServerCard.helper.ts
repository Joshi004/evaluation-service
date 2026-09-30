// Non-DOM logic for ModelServerCard.tsx: turning one endpoint row into
// a status chip's label, tone, icon and (while starting) an honest
// tooltip. `now` is a parameter, not read internally, so several cards
// on one page share ModelServerList's single ticker instead of each
// starting its own (the same reasoning RunsTableRow's own `now` prop
// already documents).
import type { ComponentType, SVGProps } from 'react'
import { CircleCheck, LoaderCircle } from 'lucide-react'
import type { EndpointListItem } from '../../api/client'
import type { BadgeTone } from '../Badge/Badge.helper'
import { MODEL_SERVER_STATUS_LABELS } from '../../utils/labels'

export interface ModelServerStatusStyle {
  label: string
  tone: BadgeTone
  icon: ComponentType<SVGProps<SVGSVGElement>>
  spin: boolean
  // Only the Starting state carries one. A start that died, timed out,
  // or never opened a tunnel looks identical to one still in progress
  // -- there is no status column, only `url IS NOT NULL` -- so it
  // stays listed, looking like this, until its row's own time limit
  // runs out (backend fix: Phase 13's own plan, "Follow-ups"). Kill
  // clears it immediately either way.
  tooltip: string | null
}

const STARTING_STATUS_TOOLTIP =
  "A start that failed still looks like this until its time limit runs out. If it's been more than a few minutes, Kill clears it now."

const MINUTE_MS = 60_000

export function modelServerStatus(
  endpoint: Pick<EndpointListItem, 'url' | 'created_at'>,
  now: Date,
): ModelServerStatusStyle {
  if (endpoint.url !== null) {
    return {
      label: MODEL_SERVER_STATUS_LABELS.serving,
      tone: 'success',
      icon: CircleCheck,
      spin: false,
      tooltip: null,
    }
  }

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(endpoint.created_at).getTime()) / MINUTE_MS),
  )
  const label =
    elapsedMinutes < 1
      ? MODEL_SERVER_STATUS_LABELS.starting
      : `${MODEL_SERVER_STATUS_LABELS.starting} \u00b7 ${elapsedMinutes}m`

  return { label, tone: 'info', icon: LoaderCircle, spin: true, tooltip: STARTING_STATUS_TOOLTIP }
}
