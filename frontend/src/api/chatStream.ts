// Streams a chat reply from POST /api/v1/endpoints/{id}/chat.
// `EventSource` can't be used here the way LogStream.helper.ts's own
// stream reads a run's logs -- EventSource only ever issues a GET, and
// this call's body (the conversation, the sampling settings) has to go
// as a POST payload. So this reads `response.body` as a raw byte
// stream and splits it into SSE frames by hand, matching the exact
// framing `app/services/endpoints/chat.py`'s own `_sse_event` writes:
// one `data: <json>\n\n` frame per event, never a payload split across
// more than one `data:` line.

import { API_BASE, errorFromResponse, type ChatRequest, type ChatStreamEvent } from './client'

const SSE_FRAME_SEPARATOR = '\n\n'
const SSE_DATA_PREFIX = 'data: '

// Posts the request and calls `onEvent` once per parsed event, in
// order, until the server closes the response or `signal` aborts (the
// composer's own Stop button). Resolves once the stream ends cleanly;
// rejects with the fetch's own AbortError on an abort, or with an
// ApiError built the same way apiFetch's own errors are (`client.ts`'s
// `errorFromResponse`) if the initial response itself was not OK.
export async function streamChatReply(
  endpointId: number,
  request: ChatRequest,
  signal: AbortSignal,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const path = `/endpoints/${endpointId}/chat`
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    throw await errorFromResponse(response, path, 'POST')
  }
  // Only possible for a response this `fetch` call didn't really
  // produce (e.g. a test double) -- a real browser's 200 response to a
  // streaming request always carries a body.
  if (response.body === null) {
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      return
    }
    buffer += decoder.decode(value, { stream: true })
    buffer = consumeCompleteFrames(buffer, onEvent)
  }
}

// Pulls every complete frame out of `buffer` and returns what's left
// over -- a single chunk read from the network can split a frame
// mid-line, so this has to buffer until a full "\n\n" separator shows
// up rather than assume one read is one frame.
function consumeCompleteFrames(buffer: string, onEvent: (event: ChatStreamEvent) => void): string {
  let remaining = buffer
  let separatorIndex = remaining.indexOf(SSE_FRAME_SEPARATOR)
  while (separatorIndex !== -1) {
    const frame = remaining.slice(0, separatorIndex)
    remaining = remaining.slice(separatorIndex + SSE_FRAME_SEPARATOR.length)
    if (frame.startsWith(SSE_DATA_PREFIX)) {
      // Trusts the backend's own JSON here the same way apiFetch casts
      // every other response body -- this is our own `chat.py`'s wire
      // format, not third-party input to validate against.
      onEvent(JSON.parse(frame.slice(SSE_DATA_PREFIX.length)) as ChatStreamEvent)
    }
    separatorIndex = remaining.indexOf(SSE_FRAME_SEPARATOR)
  }
  return remaining
}
