# Evaluation Service — backend (FastAPI), local development image.
#
# The venv lives at /opt/venv, NOT /app/.venv. docker-compose.yml bind-mounts
# ./backend over /app for hot reload, which would otherwise shadow an
# in-/app venv. Keeping it outside /app means the bind mount never touches it.

FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:${PATH}"

WORKDIR /app

# Install dependencies first so this layer is cached independently of
# application code changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

# Copy the rest of the source. In development this is immediately replaced
# by the ./backend bind mount from docker-compose.yml — harmless, since the
# venv above lives outside /app.
COPY . .
RUN uv sync --frozen

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
