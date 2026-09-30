# Evaluation Service — Frontend

React 19 + TypeScript + Vite, styled with Tailwind v4 token utilities. See
[`../README.md`](../README.md) for how to run the whole stack with Docker
Compose — that's the intended way to run this.

## Structure

- `src/main.tsx` — mounts `ThemeProvider`, `QueryClientProvider`,
  `TooltipProvider` and `CompareTrayProvider` (each once, outside the
  router) around `BrowserRouter` + `AppRoutes`.
- `src/routes.tsx` — every route, nested under `AppShell` (sidebar + top
  bar). Each page/tab is `React.lazy`-loaded into its own chunk; a
  detail page (e.g. `models/:modelId`, `runs/:runId`) owns its header
  and tab strip, with each tab as a child route rendered into that
  page's own `<Outlet>`. Old URLs redirect to their new path via
  `RedirectPreservingSearch`.
- `src/pages/` — one flat file per page or per nested-route tab (e.g.
  `ModelDetailPage.tsx` plus its tabs `ModelResultsTab.tsx`,
  `ModelRunsTab.tsx`, `ModelConfigTab.tsx`, `ModelLineageTab.tsx`). A
  page may have a flat sibling `PageName.helper.ts` for its non-DOM
  logic, the same convention `src/components/` uses, just without the
  folder — see `.cursor/rules/frontend-components.mdc`.
- `src/components/` — one folder per shared component
  (`Button/Button.tsx` + `Button.helper.ts`, ...). Convention and size
  guideline in `.cursor/rules/frontend-components.mdc`; token and
  primitive rules in `.cursor/rules/frontend-design-system.mdc`.
- `src/api/client.ts` — fetch wrapper and every response type; calls
  `/api/v1/...`, proxied to the backend container in dev (see
  `vite.config.ts`). `src/api/queries/` holds one hook file per
  resource (`useLeaderboard`, `useRuns`, `useCheckpoint`, ...), with
  every TanStack Query key centralized in `queryKeys.ts`.
- `src/utils/` — logic shared by two or more components/pages, promoted
  out of a single caller's own `.helper.ts` once a second one needs it
  (formatting, domain helpers, and hooks like `useTheme`,
  `useCompareTray`, `useUrlState`).
- **Theme.** `utils/theme.ts` (the `ThemePreference` type and
  `resolveTheme()`) plus `components/ThemeProvider/` and `utils/useTheme.ts`
  implement a System/Light/Dark toggle, exposed via `ThemeMenu` in the
  top bar. The choice persists in `localStorage`
  (`evalsvc.theme.v1`); a pre-paint script in `index.html` sets
  `data-theme` before first render so there's no flash of the wrong
  theme. Token values for both themes live in `src/index.css`.
- `/styleguide` (dev only) — every primitive in every state, in both
  themes, for a visual check against the tokens in `index.css`. Gated
  behind `import.meta.env.DEV` in `routes.tsx`, so it never ships in a
  production build.

## Running standalone (without Docker)

```bash
npm install
npm run dev -- --port 5173
```

Without the backend running too, requests through the `/api` proxy will
fail — the connectivity widget on the Leaderboard page will show an
error, which is expected in that case.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check (`tsc -b`) then build for production
- `npm run lint` — oxlint
- `npm run preview` — serve the last production build locally

## Gates

Both must pass before a change is considered done:

```bash
npm run lint    # oxlint, includes typescript/no-explicit-any
npm run build   # tsc -b && vite build
```
