import { Link } from 'react-router'
import { PageHeader } from '../components/PageHeader/PageHeader'
import { buttonClassName, BUTTON_LABEL_SIZE } from '../components/Button/Button.helper'
import { paths } from '../utils/paths'

// Reached only through the shell's catch-all route -- any path that
// isn't a real page, one of the seven redirects, or /vision|/styleguide
// (their own separate top-level routes). Rendered inside AppShell like
// every other page (routes.tsx wraps it in Page, same as the rest), so
// the sidebar and top bar are still there to navigate away from.
export function NotFoundPage() {
  return (
    <PageHeader
      title="Page not found"
      description="Nothing lives at this address. It may have moved, or the link was wrong."
      actions={
        <Link to={paths.leaderboard()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
          Back to Leaderboard
        </Link>
      }
    />
  )
}
