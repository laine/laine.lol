# Docker Deployment

Rustybin ships as a **single container**: the axum backend serves the pre-built React SPA
same-origin (the frontend is built with `VITE_API_URL=/v1`), so one image runs the whole app —
API, UI, and SQLite storage.

## Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/)
- Docker Compose v2 (`docker compose`, bundled with modern Docker)

## Quick start

From the repository root, choose one of the two paths.

**Option A — run the published image (recommended for production)**

```bash
# .env
echo "RUSTYBIN_IMAGE=ghcr.io/eternityx/rustybin:latest" >> .env

docker compose up -d --no-build
```

**Option B — build the image locally**

```bash
docker compose up -d --build
```

Then open <http://localhost:3000> (change the host port with `HOST_PORT`). Follow logs with:

```bash
docker compose logs -f
```

## Configuration

Compose reads a `.env` file next to `docker-compose.yml`. A minimal production `.env`:

```env
# Which image to run (omit to build locally from the Dockerfile)
RUSTYBIN_IMAGE=ghcr.io/eternityx/rustybin:latest

# Host port mapped to the container's 3000
HOST_PORT=3000

# Build arg — only matters when BUILDING the image (see note below)
VITE_API_URL=/v1

# REQUIRED for a real deployment: your public origin(s), comma-separated.
# The browser is blocked by CORS if this doesn't include the URL you serve from.
CORS_ALLOWED_ORIGINS=https://paste.example.com

# Set to enable the admin dashboard at /admin (leave unset to keep it disabled)
ADMIN_SECRET=change-me
```

> **`VITE_API_URL` is baked in at build time**, not read at runtime. The published GHCR image is
> already built with `/v1`, so same-origin works out of the box — leave it alone. Only override it
> (and rebuild) if you serve the API from a separate domain, e.g.
> `docker build --build-arg VITE_API_URL=https://api.example.com/v1 .`

For the complete list of backend settings (rate limits, admin session length, logging, etc.), see the
[environment variable reference](README.md#backend-environment-variables) — every variable there can be
set under `environment:` in `docker-compose.yml` or in your `.env`.

**Production note:** terminate TLS at a reverse proxy (nginx, Caddy, Traefik) in front of the
container and set `CORS_ALLOWED_ORIGINS` to your `https://` origin.

## Data & persistence

Pastes are stored in SQLite at `/app/data/pastes.db`, kept in the named volume `rustybin-data`. The
data survives container restarts, recreation, and image upgrades.

- `docker compose down` stops the container but **keeps** the volume (and your data).
- `docker compose down -v` **deletes** the volume — only use it if you want to wipe all pastes.

## Health checks

The image defines a `HEALTHCHECK` that polls `/v1/health`. Docker reports the result in
`docker ps` (`healthy` / `unhealthy`), and Compose uses it for the container's health status. The
endpoint returns HTTP `200` when the service is `ok` or `degraded`, and `503` when `unhealthy`.

## Releases & images

Images are published to the GitHub Container Registry by the
[`Docker image`](.github/workflows/docker-image.yml) workflow:

- Push a semver tag (`vMAJOR.MINOR.PATCH`, e.g. `v1.4.0`) to build and push automatically.
- Each release publishes the tags `{version}` (e.g. `1.4.0`), `{major}.{minor}` (e.g. `1.4`), and
  `latest`.
- The workflow can also be triggered manually from the Actions tab (`workflow_dispatch`).

Pull a specific version by setting `RUSTYBIN_IMAGE`, for example
`RUSTYBIN_IMAGE=ghcr.io/eternityx/rustybin:1.4` in your `.env`.
