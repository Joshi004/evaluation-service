import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { AppRoutes } from './routes'
import { Toaster } from './components/Toaster/Toaster'
import { CompareTrayProvider } from './components/CompareTrayProvider/CompareTrayProvider'
import { ThemeProvider } from './components/ThemeProvider/ThemeProvider'
import './index.css'

// A global floor of 30s before any query is considered stale -- most
// navigation within the app (going back to a page still showing recent
// data) shouldn't refetch every time. Polling queries (health,
// endpoints, runs, a running run's own detail) set their own
// refetchInterval regardless, so this floor never slows them down;
// catalog-like lists set a longer one of their own
// (api/queries/catalogQueryOptions.ts).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
})

// ThemeProvider is outermost -- it depends on nothing below it, and
// Toaster needs its resolvedTheme even though Toaster itself sits
// beside, not inside, the other providers. TooltipProvider (shared
// open delay), Toaster (mutation feedback) and CompareTrayProvider
// (the pinned-runs basket) are each mounted once here, per the
// design-system spec, rather than once per page. CompareTrayProvider
// wraps the router (not the other way round) so its one revalidation
// fetch (useRuns inside the provider) still has a QueryClientProvider
// above it, and every routed page below it can call useCompareTray().
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <CompareTrayProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </CompareTrayProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
