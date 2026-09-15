// Non-DOM logic for PathReferenceInput.tsx: a cheap client-side mirror
// of the server's own `validate_reference` syntax checks (R-D10), so an
// obviously malformed path is caught before a round trip. The server
// re-validates regardless -- this is UX, not a security boundary.
import type { CheckpointCandidate } from '../../api/client'

export function pathReferenceError(rawPath: string): string | null {
  const trimmedPath = rawPath.trim()
  if (trimmedPath === '') {
    return null
  }
  if (!trimmedPath.startsWith('/')) {
    return 'Path must be absolute (start with /)'
  }
  if (trimmedPath.split('/').includes('..')) {
    return "Path must not contain '..'"
  }
  return null
}

// Builds the same shape CandidateBrowser's rows produce, so a typed
// path can feed the wizard's existing onSelect handler unchanged --
// steps 2 through 4 already work from a CheckpointCandidate plus its
// inspection, and inspection returns the same shape either way. Returns
// null whenever the path is empty or fails the syntax check above, so
// the caller can use this alone to decide whether "Use this path" is
// clickable.
export function candidateFromPath(rawPath: string): CheckpointCandidate | null {
  const trimmedPath = rawPath.trim()
  if (trimmedPath === '' || pathReferenceError(trimmedPath) !== null) {
    return null
  }

  // Strips a trailing slash before taking the last segment, so
  // "/a/b/" and "/a/b" produce the same display name and reference.
  const normalizedPath =
    trimmedPath.length > 1 && trimmedPath.endsWith('/') ? trimmedPath.slice(0, -1) : trimmedPath
  const segments = normalizedPath.split('/')
  const displayName = segments[segments.length - 1]

  return {
    reference: normalizedPath,
    display_name: displayName,
    already_registered: false,
    modified_at: null,
  }
}
