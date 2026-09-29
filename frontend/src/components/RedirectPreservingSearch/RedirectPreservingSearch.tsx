import { Navigate, useLocation } from 'react-router'

interface RedirectPreservingSearchProps {
  to: string
}

// Every old URL in docs/UI_REDESIGN_PLAN.md §4.2's route map keeps
// working (decision D9) -- deep links pasted in Slack shouldn't 404
// just because a page moved. `replace` so the old URL doesn't stay in
// browser history between the new page and wherever the user came from.
export function RedirectPreservingSearch({ to }: RedirectPreservingSearchProps) {
  const location = useLocation()
  return <Navigate to={{ pathname: to, search: location.search }} replace />
}
