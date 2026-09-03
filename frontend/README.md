# Evaluation Service — Frontend

React + TypeScript + Vite. See [`../README.md`](../README.md) for how to
run the whole stack with Docker Compose — that's the intended way to run
this.

## Structure

- `src/main.tsx` — `QueryClientProvider` + `BrowserRouter` setup
- `src/App.tsx` — page shell: header, nav, `<Outlet />`
- `src/routes.tsx` — wires the nine pages from `EVAL_SERVICE_PLAN.md`, Section 13, under the shell
- `src/pages/` — one stub component per page
- `src/api/client.ts` — fetch wrapper; calls `/api/v1/...`, proxied to the backend container in dev (see `vite.config.ts`)
- `src/components/` — empty; shared components will land here

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
