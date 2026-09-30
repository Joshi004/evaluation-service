// Non-DOM logic for StartModelServerDialog.tsx: what POST /endpoints
// will actually do for the selected model, computed from the backend's
// own reuse rule (app/services/endpoints/queries.py's
// find_reusable_endpoint: same checkpoint_id and serving_profile_id,
// and url IS NOT NULL) rather than guessed independently -- if that
// rule ever changes, this is the one place to update to match it.
import type { CheckpointListItem, EndpointListItem } from '../../api/client'
import type { CalloutTone } from '../Callout/Callout.helper'

export type StartOutcomeKind = 'reuse' | 'already-starting' | 'new'

export interface StartOutcome {
  kind: StartOutcomeKind
  tone: CalloutTone
  message: string
}

function gpuPhrase(gpus: number): string {
  return `${gpus} GPU${gpus === 1 ? '' : 's'}`
}

// `checkpoint.default_serving_profile_id` is always the profile a
// manual start would use -- POST /endpoints has no field to choose a
// different one (CreateEndpointRequest's own docstring) -- so that is
// the only profile this ever matches against. `gpus` comes from that
// same profile (useServingProfiles), not from the checkpoint itself.
export function describeStartOutcome(
  checkpoint: Pick<CheckpointListItem, 'id' | 'default_serving_profile_id'>,
  liveEndpoints: Pick<EndpointListItem, 'checkpoint_id' | 'serving_profile_id' | 'url'>[],
  gpus: number,
): StartOutcome {
  const matching = liveEndpoints.filter(
    (endpoint) =>
      endpoint.checkpoint_id === checkpoint.id &&
      endpoint.serving_profile_id === checkpoint.default_serving_profile_id,
  )

  if (matching.some((endpoint) => endpoint.url !== null)) {
    return {
      kind: 'reuse',
      tone: 'info',
      message: 'Reuses the running server. Nothing new is reserved.',
    }
  }

  // The backend's own reuse check requires url IS NOT NULL -- a
  // server still starting for this model is not reused, so this would
  // submit a second one rather than waiting for the first.
  if (matching.length > 0) {
    return {
      kind: 'already-starting',
      tone: 'warning',
      message: `A server for this model is already starting. Another one reserves ${gpuPhrase(gpus)} more.`,
    }
  }

  return {
    kind: 'new',
    tone: 'info',
    message: `Reserves ${gpuPhrase(gpus)} on the default partition until its time limit runs out or you kill it.`,
  }
}
