# Evaluation Service — Backend

FastAPI + SQLAlchemy 2.0 (async) + Alembic + Pydantic v2. See
[`../README.md`](../README.md) for how to run the whole stack with
Docker Compose — that's the intended way to run this.

## Structure

- `app/main.py` — app factory, CORS, router mount, lifespan
- `app/config.py` — `Settings` (pydantic-settings), reads `DATABASE_URL` / `REDIS_URL`
- `app/db.py` — async engine + session factory
- `app/cache.py` — Redis client factory
- `app/models/` — SQLAlchemy ORM models (only `Base` so far — see `EVAL_SERVICE_PLAN.md`, Section 10, for the intended schema)
- `app/schemas/` — Pydantic request/response schemas (empty so far)
- `app/api/v1/` — one router per resource; only `health.py` has real logic today
- `app/services/` — `cluster` (SSH connector), `reconciler`, `s3`, `standards` — all stubs, see their module docstrings for what belongs there

## Running standalone (without Docker)

Requires a reachable Postgres and Redis — set `DATABASE_URL` / `REDIS_URL`
if you're not pointing at the Docker Compose defaults:

```bash
uv sync
uv run uvicorn app.main:app --reload
```

## Migrations

Zero migrations exist yet — no models are defined beyond the declarative
`Base`. Once a model is added under `app/models/`:

```bash
alembic revision --autogenerate -m "..."
alembic upgrade head
```
