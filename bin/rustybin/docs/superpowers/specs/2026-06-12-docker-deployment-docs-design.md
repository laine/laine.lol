# Docker deployment docs — design spec

**Date:** 2026-06-12
**Branch:** `003-foxybin-redesign`
**Status:** Awaiting review

## Context

The single-container deployment infrastructure already exists in the repo (currently untracked):

- `Dockerfile` — 3-stage build: `node:22-alpine` builds the Vite SPA (`VITE_API_URL=/v1` build arg) →
  `rust:1-slim-bookworm` builds the release binary (cached dependency layer) → `debian:bookworm-slim`
  runtime as non-root user `rustybin` (uid/gid 10001). SQLite lives at `/app/data/pastes.db` on a
  `VOLUME`. `HEALTHCHECK` hits `/v1/health` via `wget`. `ENV RUST_ENV=production PORT=3000 RUST_LOG=info`.
- `docker-compose.yml` — `image: ${RUSTYBIN_IMAGE:-rustybin:latest}`, builds with the `VITE_API_URL`
  arg, `ports: ${HOST_PORT:-3000}:3000`, env-driven config (CORS, rate limits, admin), named volume
  `rustybin-data:/app/data`, `restart: unless-stopped`.
- `.dockerignore` — keeps the build context minimal and secrets out (`.env`, `data`, `*.db`, `target`,
  `node_modules`, `dist`).
- `.github/workflows/docker-image.yml` — on `v*.*.*` tag push (and `workflow_dispatch`), builds and
  pushes to GHCR with semver tags (`{version}`, `{major}.{minor}`) + branch/sha, GHA layer caching,
  `GITHUB_TOKEN` auth, `linux/amd64`.

Confirmed backend behavior (`src/main.rs`):
- The SPA is served same-origin from `./dist` **only when `RUST_ENV=production`** (fallback service).
- DB path is `data/pastes.db` relative to the working dir (→ `/app/data/pastes.db` in the container).
- `/v1/health` returns `ok`/`degraded` (HTTP 200) or `unhealthy` (HTTP 503).
- Config via env: `PORT`, `RUST_ENV`, `CORS_ALLOWED_ORIGINS`, `READ/CREATE/UPDATE/DELETE_RATE_LIMIT`,
  `RUST_LOG`, `ADMIN_SECRET` (enables `/v1/admin` when set), `ADMIN_SESSION_HOURS`,
  `ADMIN_LOGIN/READ/DELETE_RATE_LIMIT`.

Existing docs: `README.md` already has a complete backend **env-var table**, API reference, a generic
**Deployment** section, and a **Cloudflare** pointer to `site/DEPLOYMENT.md`. There is **no
Docker-specific doc**. The task is to add one.

## Decisions (locked during brainstorming)

- **Location:** a single `DOCKER.md` at the repo root (matches the existing flat doc layout next to
  `README.md`, `API_ENCRYPTION.md`).
- **README integration:** add a short `### Docker` subsection under the existing `## Deployment`
  section that links to `DOCKER.md`. No other README changes. (The user explicitly approved this edit,
  overriding the general "don't touch existing markdown" preference for this request.)
- **Depth:** concise quickstart — not an exhaustive ops manual.
- **DRY:** do not duplicate the full env-var table; link to README's table. `DOCKER.md` documents only
  the Docker-specific knobs and the one self-host must-set (`CORS_ALLOWED_ORIGINS`).

## `DOCKER.md` outline

1. **Intro** — single-container model: the axum backend serves the built SPA same-origin
   (`VITE_API_URL=/v1`), so one image runs the whole app.
2. **Prerequisites** — Docker + Compose v2.
3. **Quick start (two paths):**
   - *Pull the published image* (production): set `RUSTYBIN_IMAGE=ghcr.io/eternityx/rustybin:latest`
     in `.env`, then `docker compose up -d --no-build`.
   - *Build locally*: `docker compose up -d --build`.
   - Open `http://localhost:3000` (override with `HOST_PORT`).
4. **Configuration** — a minimal `.env` example covering the Docker-specific knobs (`RUSTYBIN_IMAGE`,
   `HOST_PORT`, `VITE_API_URL`) and the self-host must-set `CORS_ALLOWED_ORIGINS`. Callout:
   `VITE_API_URL` is **baked at build time** — the GHCR image ships with `/v1` so same-origin works out
   of the box; only override when building for a split API domain. Link to README's env table for the
   full list. One-line production note: terminate TLS at a reverse proxy and set
   `CORS_ALLOWED_ORIGINS` to your `https://` origin.
5. **Data persistence** — pastes live in the named `rustybin-data` volume at `/app/data/pastes.db`;
   survives container replacement.
6. **Health** — the container reports health via `/v1/health`; `docker ps` shows healthy/unhealthy.
7. **Releases → images** — pushing a `v*.*.*` git tag triggers the GH Actions workflow to build and
   publish to GHCR (`{version}`, `{major}.{minor}`, `latest`); pull with `RUSTYBIN_IMAGE`.

## Out of scope (per "concise")

Full reverse-proxy/TLS walkthrough, backup/restore procedures, and a troubleshooting section. Their
essence is condensed into the one-line production note in §4.

## Verification

- Markdown renders cleanly; the README → `DOCKER.md` link resolves; commands and env names match the
  actual `Dockerfile`/`docker-compose.yml`/workflow. No code or container changes — docs only.
