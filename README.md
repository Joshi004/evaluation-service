# Evaluation Service

A shared evaluation service: one place to register a checkpoint, run it
against a standard benchmark recipe, and see the result on a leaderboard
next to everyone else's numbers. The full pipeline works end to end
today — see [Status](#status) below for exactly how far. See the design
docs for what's built, what isn't, and why:

- [`docs/EVAL_SERVICE_PLAN.md`](docs/EVAL_SERVICE_PLAN.md) — the build plan and tech stack
- [`docs/CURRENT_STATE_ANALYSIS.md`](docs/CURRENT_STATE_ANALYSIS.md) — an honest status and gap analysis: what actually works end to end, what doesn't yet, and how far it is from matching the other teams' benchmark coverage
- [`docs/DATA_MODEL_V1.md`](docs/DATA_MODEL_V1.md) — the Postgres schema actually built, the recipe hash rule, and how a run moves
- [`docs/UI_REDESIGN_PLAN.md`](docs/UI_REDESIGN_PLAN.md) — the frontend's information architecture and its phase-by-phase redesign log
- [`docs/BENCHMARK_UNIFICATION_RESEARCH.md`](docs/BENCHMARK_UNIFICATION_RESEARCH.md) — how the four teams evaluate today

## Stack

| Piece | Technology | Where |
|---|---|---|
| Backend | FastAPI + SQLAlchemy 2.0 (async) + Alembic + Pydantic v2 | [`backend/`](backend/) |
| Frontend | React + TypeScript + Vite | [`frontend/`](frontend/) |
| Database | Postgres 17 | Docker container, named volume |

Three containers, one `docker-compose.yml`. Backend and frontend source
directories are bind-mounted into their containers for local hot reload;
Postgres data lives in a named Docker volume (not bind-mounted), which
avoids macOS bind-mount permission and fsync quirks.

## Running it

```bash
cp .env.example .env      # optional — only needed to override a default
docker compose up --build
```

Then:

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/v1/health — reports whether the
  API can actually reach Postgres, not just that the container started

Stop everything with `docker compose down`. Add `-v` to also drop the
named Postgres volume (deletes all local data).

### Adding a dependency

Because `node_modules` is an anonymous volume (so the host's copy doesn't
shadow the container's), adding a frontend package needs a rebuild:

```bash
docker compose up --build -V frontend
```

For the backend, edit `backend/pyproject.toml`, then:

```bash
docker compose exec backend uv lock
docker compose up --build backend
```

### Database migrations

Five migrations exist under `backend/alembic/versions/`, covering the
core tables and their additions since. After changing a model under
`backend/app/models/`, generate the next one with:

```bash
docker compose exec backend alembic revision --autogenerate -m "..."
docker compose exec backend alembic upgrade head
```

## Layout

```
docker-compose.yml
.env.example
docs/                 design docs — plan, data model, current status, UI redesign, research
catalog/              version-controlled catalog YAML — standards, sampling profiles, serving profiles
backend/              FastAPI control-plane API — see backend/README.md
frontend/             React + Vite UI — see frontend/README.md
```

## Status

The full pipeline works end to end for one harness (EvalScope) and five
benchmarks (IFEval, IFBench, GSM8K, GPQA-Diamond, MMLU-Pro): register a
checkpoint, submit a run, the backend SSHes into the SLURM cluster,
starts a vLLM server, runs the harness against it over a tunnel, parses
the report, and the leaderboard reads the result from Postgres. Five
migrations are applied. A model with a running server can also be
chatted with directly from the Chat page — a manual playground for
checking a model by hand, independent of any benchmark run, with
per-model history saved in the browser. The frontend's UI redesign
(`docs/UI_REDESIGN_PLAN.md`, 14 phases) is complete. `app/services/reconciler/`
and `app/services/s3/` are still stubs — see `docs/CURRENT_STATE_ANALYSIS.md`
for the full gap analysis against the other evaluation teams.
