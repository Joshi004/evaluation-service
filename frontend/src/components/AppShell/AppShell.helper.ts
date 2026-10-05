import type { ComponentType, SVGProps } from 'react'
import { Trophy, Box, GitCompare, Plus, Activity, Target, SlidersHorizontal, Server, MessageSquare } from 'lucide-react'
import { paths } from '../../utils/paths'

export interface NavItem {
  label: string
  to: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export interface NavGroup {
  heading: string
  items: NavItem[]
}

// Four groups, in a fixed order. Labels match the vocabulary used
// elsewhere in the app (Models, Benchmarks, ...) except "Endpoints",
// which keeps this label even though the route itself moves to
// /infrastructure.
export const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Results',
    items: [
      { label: 'Leaderboard', to: paths.leaderboard(), icon: Trophy },
      { label: 'Models', to: paths.models(), icon: Box },
      { label: 'Compare', to: paths.compare(), icon: GitCompare },
    ],
  },
  {
    heading: 'Evaluate',
    items: [
      { label: 'New evaluation', to: paths.newEvaluation(), icon: Plus },
      { label: 'Runs', to: paths.runs(), icon: Activity },
      { label: 'Chat', to: paths.chat(), icon: MessageSquare },
    ],
  },
  {
    heading: 'Library',
    items: [
      { label: 'Benchmarks', to: paths.benchmarks(), icon: Target },
      // One item, not two: Sampling and Serving profiles are now tabs
      // of the one Profiles page, so the sidebar only needs the one
      // link that page's own TabNav starts on.
      { label: 'Profiles', to: paths.profiles(), icon: SlidersHorizontal },
    ],
  },
  {
    heading: 'Infrastructure',
    items: [{ label: 'Endpoints', to: paths.infrastructure(), icon: Server }],
  },
]

const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

// The top bar's breadcrumb slot and the document title (useDocumentTitle,
// called once from AppShell) both resolve from the current path this
// way, rather than each of the 13 existing pages setting its own title
// -- that would mean editing every page body, out of this phase's scope.
export function resolvePageTitle(pathname: string): string {
  const exactMatch = ALL_NAV_ITEMS.find((item) => item.to === pathname)
  if (exactMatch) return exactMatch.label

  // Longest-prefix match so a nested route (e.g. /runs/13/samples/9)
  // resolves to its section (Runs). '/' is excluded by construction --
  // `${item.to}/` becomes '//', which no real pathname starts with -- so
  // Leaderboard's item can never swallow every other route.
  const prefixMatches = ALL_NAV_ITEMS.filter((item) => item.to !== '/' && pathname.startsWith(`${item.to}/`))
  const longestPrefixMatch = [...prefixMatches].sort((a, b) => b.to.length - a.to.length)[0]
  return longestPrefixMatch?.label ?? 'Not found'
}
