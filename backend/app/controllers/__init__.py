"""Controllers — the middle layer between routers and libraries.

Per .cursor/rules/backend-layering.mdc: a controller validates a request
beyond what its Pydantic schema already guarantees, orchestrates one or
more calls into app.services, and shapes the response. It never queries
the database or calls SSH/S3/HTTP itself — that belongs in app.services.

app.api.v1.health is the one deliberate exception: it's a two-line
infrastructure check, not a feature, so its router talks to the DB/Redis
clients directly instead of going through a controller.

Not implemented yet.
"""
