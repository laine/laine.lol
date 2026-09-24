# syntax=docker/dockerfile:1

########################################
# Stage 1 — frontend (Vite/React SPA)
########################################
FROM node:22-alpine AS frontend
WORKDIR /site

# The backend serves the SPA same-origin in production, so a relative
# API base works. Override at build time for a split deployment:
#   docker build --build-arg VITE_API_URL=https://api.example.com/v1 .
ARG VITE_API_URL=/v1
ENV VITE_API_URL=${VITE_API_URL}

COPY site/package.json site/package-lock.json ./
RUN npm ci

COPY site/ ./
RUN npm run build

########################################
# Stage 2 — backend (axum, release build)
########################################
FROM rust:1-slim-bookworm AS backend
WORKDIR /app

# Build dependencies against a dummy main first so the (slow) dependency
# layer is cached and only invalidated when Cargo.toml/Cargo.lock change.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src \
    && echo 'fn main() {}' > src/main.rs \
    && cargo build --release \
    && rm -rf src \
        target/release/rustybin \
        target/release/deps/rustybin* \
        target/release/.fingerprint/rustybin-*

COPY src ./src
RUN cargo build --release

########################################
# Stage 3 — runtime
########################################
FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 rustybin \
    && useradd --system --uid 10001 --gid rustybin --home-dir /app rustybin

COPY --from=backend /app/target/release/rustybin /usr/local/bin/rustybin
COPY --from=frontend /site/dist ./dist

# SQLite database lives at ./data/pastes.db relative to the workdir —
# keep it on a volume so pastes survive container replacement.
RUN mkdir -p /app/data && chown -R rustybin:rustybin /app
VOLUME ["/app/data"]

ENV RUST_ENV=production \
    PORT=3000 \
    RUST_LOG=info

EXPOSE 3000
USER rustybin

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider "http://127.0.0.1:${PORT}/v1/health" || exit 1

CMD ["rustybin"]