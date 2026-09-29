import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { AppRoutes } from './routes'
import { Toaster } from './components/Toaster/Toaster'
import './index.css'

const queryClient = new QueryClient()

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
