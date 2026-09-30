import { Navigate, useLocation, useParams } from 'react-router'

interface RedirectPreservingSearchProps {
  // A function target reads this route's own params (the
  // `/runs/:runId/diagnostics` -> `/runs/:runId/samples` redirect is the
  // first caller that needs one) -- a plain string still covers every
  // param-free old path.
  to: string | ((params: Readonly<Record<string, string | undefined>>) => string)
}

// Every old URL keeps working -- deep links pasted in Slack shouldn't 404
// just because a page moved. `replace` so the old URL doesn't stay in
// browser history between the new page and wherever the user came from.
export function RedirectPreservingSearch({ to }: RedirectPreservingSearchProps) {
  const location = useLocation()
  const params = useParams()
  const pathname = typeof to === 'function' ? to(params) : to
  return <Navigate to={{ pathname, search: location.search }} replace />
}
