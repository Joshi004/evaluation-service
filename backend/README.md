# Evaluation Service — Backend

FastAPI + SQLAlchemy 2.0 (async) + Alembic + Pydantic v2. See
[`../README.md`](../README.md) for how to run the whole stack with
Docker Compose — that's the intended way to run this.

## Structure

- `app/main.py` — app factory, CORS, router mount, lifespan
- `app/config.py` — `Settings` (pydantic-settings): `DATABASE_URL`, CORS, and the cluster SSH / path / harness-image config the services below read
- `app/db.py` — async engine + session factory
- `app/models/` — the SQLAlchemy ORM models (`checkpoint`, `standard`, `sampling_profile`, `serving_profile`, `eval_run`, `run_group`, `endpoint`, `metric`) — see `docs/DATA_MODEL_V1.md` for the schema
- `app/schemas/` — Pydantic request/response schemas, one module per resource
- `app/api/v1/` — one router per resource (`checkpoints`, `standards`, `sampling_profiles`, `serving_profiles`, `runs`, `run_groups`, `endpoints`, `diagnostics`, `leaderboard`, `cluster`, `health`); each delegates to `app/controllers/`, which calls `app/services/`, per `.cursor/rules/backend-layering.mdc`
- `app/services/` — one package per domain (`checkpoints`, `standards`, `sampling_profiles`, `serving_profiles`, `runs`, `endpoints`, `diagnostics`, `discovery`, `harness`, `leaderboard`, `catalog`, `compatibility`, `cluster` — the last a real SSH connector, tunnel and SLURM runtime, not a stub). `reconciler/` and `s3/` are still stubs; see their module docstrings for what belongs there

## Running standalone (without Docker)

Requires a reachable Postgres — set `DATABASE_URL` if you're not pointing
at the Docker Compose defaults:

```bash
uv sync
uv run uvicorn app.main:app --reload
```

## Migrations

Five migrations exist under `alembic/versions/`, covering the core
tables and their additions since. After changing a model under
`app/models/`, generate the next one with:

```bash
alembic revision --autogenerate -m "..."
alembic upgrade head
```
