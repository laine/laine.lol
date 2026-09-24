# Docker Deployment Docs Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. This is a
> documentation-only change — no code, no container changes.

**Goal:** Add a concise `DOCKER.md` quickstart at the repo root and link it from README's Deployment section.

**Architecture:** Documentation only. `DOCKER.md` describes the existing single-container setup
(Dockerfile + docker-compose.yml + GHCR workflow). README gets a small `### Docker` subsection linking
to it. The full env-var reference stays in README (DRY); `DOCKER.md` covers only Docker-specific knobs.

**Tech Stack:** Markdown. Facts must match `Dockerfile`, `docker-compose.yml`,
`.github/workflows/docker-image.yml`, and `src/main.rs`.

---

## Reference facts (must match the doc)

- GHCR image (repo `EternityX/rustybin`, lowercased): `ghcr.io/eternityx/rustybin`.
- Compose vars: `RUSTYBIN_IMAGE` (default `rustybin:latest`), `HOST_PORT` (default `3000`),
  `VITE_API_URL` build arg (default `/v1`), plus `RUST_LOG`, `CORS_ALLOWED_ORIGINS`
  (compose default `http://localhost:3000`), rate limits, `ADMIN_SECRET`, `ADMIN_SESSION_HOURS`.
- Container listens on `3000`; published as `${HOST_PORT}:3000`.
- Data volume: `rustybin-data` → `/app/data` (DB at `/app/data/pastes.db`).
- Health: `/v1/health` → 200 (`ok`/`degraded`) or 503 (`unhealthy`).
- `VITE_API_URL` is baked at build time (frontend stage); the published image ships with `/v1`.
- Release: push a `v*.*.*` tag → workflow builds + pushes GHCR tags `{version}`, `{major}.{minor}`, `latest`.

---

## Task 1: Create `DOCKER.md`

**Files:** Create `DOCKER.md` (repo root).

- [ ] **Step 1:** Write `DOCKER.md` with these sections, concise:
  1. **Title + intro** — single-container model; backend serves the SPA same-origin (`VITE_API_URL=/v1`).
  2. **Prerequisites** — Docker Engine + Compose v2.
  3. **Quick start** — two fenced `bash` paths:
     - Pull published image: set `RUSTYBIN_IMAGE=ghcr.io/eternityx/rustybin:latest` in `.env`, then
       `docker compose up -d --no-build`.
     - Build locally: `docker compose up -d --build`.
     - Note: open `http://localhost:3000` (override via `HOST_PORT`); `docker compose logs -f`.
  4. **Configuration** — a minimal `.env` example (`env` fence) with `RUSTYBIN_IMAGE`, `HOST_PORT`,
     `VITE_API_URL`, `CORS_ALLOWED_ORIGINS`, `ADMIN_SECRET`. Callout that `VITE_API_URL` is baked at
     build time (image ships `/v1`; only override for a split API domain). Link to the README env
     table: `See the [environment variable reference](README.md#backend-environment-variables)`.
     One-line production note: terminate TLS at a reverse proxy and set `CORS_ALLOWED_ORIGINS` to your
     `https://` origin.
  5. **Data & persistence** — named `rustybin-data` volume at `/app/data/pastes.db`; survives
     container replacement; `docker compose down` keeps it, `down -v` deletes it.
  6. **Health checks** — `/v1/health`; `docker ps` shows `healthy`/`unhealthy`.
  7. **Releases & images** — push a `v*.*.*` tag → GHCR publish (`{version}`, `{major}.{minor}`,
     `latest`); also runnable manually via `workflow_dispatch`.

- [ ] **Step 2:** Re-read against the Reference facts above; confirm every command, env name, port,
  path, and image name matches the actual files. Confirm the README anchor
  `#backend-environment-variables` matches README's `#### Backend Environment Variables` heading.

- [ ] **Step 3: Commit** (root `DOCKER.md` is gitignored-safe — verify it is tracked):

```bash
git add DOCKER.md
git commit -m "docs: add Docker single-container deployment guide"
```

---

## Task 2: Link `DOCKER.md` from README

**Files:** Modify `README.md` (the `## Deployment` section, before `## Cloudflare`).

- [ ] **Step 1:** Add a `### Docker` subsection at the end of the `## Deployment` section with a 2–3
  line summary (single-container image; runs the whole app) and a link: `See **[DOCKER.md](DOCKER.md)**
  for the Docker / Docker Compose quickstart, GHCR images, and configuration.` Make no other changes to
  README.

- [ ] **Step 2:** Confirm the link target and that no unrelated README lines changed
  (`git diff README.md` shows only the added subsection).

- [ ] **Step 3: Commit:**

```bash
git add README.md
git commit -m "docs(readme): link Docker deployment guide from Deployment section"
```

---

## Self-Review

- **Spec coverage:** `DOCKER.md` (Task 1) covers intro, quickstart, config, persistence, health,
  releases — matching the spec outline. README link (Task 2) matches the "short subsection" decision.
- **DRY:** env table is linked, not duplicated.
- **Accuracy:** Reference-facts block keeps commands/names aligned with the real files.
- **Scope:** docs only; no reverse-proxy/backup/troubleshooting sections (condensed to one line).
