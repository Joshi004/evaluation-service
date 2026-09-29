import { useEffect } from 'react'

// Called once, centrally, from AppShell -- not from each page. Editing
// all 13 existing page bodies just to set a title would violate Phase
// 2's own "don't redesign a page body" scope; deriving the title from
// the route instead (AppShell.helper.ts's resolvePageTitle) means none
// of them need to change.
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · Evaluation Service`
  }, [title])
}
