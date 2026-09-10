"""Pydantic request/response schemas.

One module per resource (checkpoints, standards, sampling_profiles,
serving_profiles, leaderboard, runs, endpoints), each imported directly
by its router — kept separate from the ORM models in app/models so the
wire format can evolve independently of the database schema.
"""
