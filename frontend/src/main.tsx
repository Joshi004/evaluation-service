import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { AppRoutes } from './routes'
import { Toaster } from './components/Toaster/Toaster'
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

// TooltipProvider (shared open delay) and Toaster (mutation feedback)
// are each mounted once here, per the design-system spec, rather than
// once per page.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
