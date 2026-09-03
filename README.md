# Evaluation Service

A shared evaluation service: one place to register a checkpoint, run it
against a standard benchmark recipe, and see the result on a leaderboard
next to everyone else's numbers.

This repository currently contains **the basic application structure
only** — no business logic yet. See the design docs for what's actually
being built and why:

- [`docs/EVAL_SERVICE_PLAN.md`](docs/EVAL_SERVICE_PLAN.md) — the build plan and tech stack
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — the Postgres schema, what Redis holds, and how a run moves
- [`docs/CLUSTER_VALIDATION.md`](docs/CLUSTER_VALIDATION.md) — hands-on validation of the SLURM cluster
- [`docs/BENCHMARK_UNIFICATION_RESEARCH.md`](docs/BENCHMARK_UNIFICATION_RESEARCH.md) — how the four teams evaluate today

## Stack

| Piece | Technology | Where |
|---|---|---|
| Backend | FastAPI + SQLAlchemy 2.0 (async) + Alembic + Pydantic v2 | [`backend/`](backend/) |
| Frontend | React + TypeScript + Vite | [`frontend/`](frontend/) |
| Database | Postgres 17 | Docker container, named volume |
| Cache / queue / locks | Redis 7 | Docker container, named volume |

Four containers, one `docker-compose.yml`. Backend and frontend source
directories are bind-mounted into their containers for local hot reload;
Postgres and Redis data live in named Docker volumes (not bind-mounted),
which avoids macOS bind-mount permission and fsync quirks.

## Running it

```bash
cp .env.example .env      # optional — only needed to override a default
docker compose up --build
```

Then:

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/v1/health — reports whether the
  API can actually reach Postgres and Redis, not just that the container
  started

Stop everything with `docker compose down`. Add `-v` to also drop the
named Postgres/Redis volumes (deletes all local data).

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

Alembic is initialized with zero migrations. Once models exist under
`backend/app/models/`, generate a migration with:

```bash
docker compose exec backend alembic revision --autogenerate -m "..."
docker compose exec backend alembic upgrade head
```

## Layout

```
docker-compose.yml
.env.example
docs/                 design docs — plan, data model, cluster validation, research
standards/            version-controlled benchmark recipe YAML (empty so far)
backend/              FastAPI control-plane API — see backend/README.md
frontend/             React + Vite UI — see frontend/README.md
```

## Status

Basic structure only, per the plan. Nothing beyond a health check that
proves the four containers can talk to each other is implemented yet.
