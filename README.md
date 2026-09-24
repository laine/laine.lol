# laine.lol

Everything behind **[laine.lol](https://laine.lol)** and its subdomains. The whole
stack is one Docker Compose project on a small Linux box (2 cores, 3 GB RAM),
published through a Cloudflare Tunnel. No port is open to the internet.

| Site | What it is | Source |
| --- | --- | --- |
| [laine.lol](https://laine.lol) | Landing page (static) | [`web/`](web/) |
| [asf.laine.lol](https://asf.laine.lol) | [ArchiSteamFarm](https://github.com/JustArchiNET/ArchiSteamFarm) IPC web UI, recolored to the site accent | [`asf/`](asf/) + the `asf` block in [`web/nginx.conf`](web/nginx.conf) |
| [bin.laine.lol](https://bin.laine.lol) | End-to-end encrypted pastebin (Rust + React) | [`bin/rustybin/`](bin/rustybin/) |
| [cs2.laine.lol](https://cs2.laine.lol) | Archive of every Counter-Strike 2 build's binaries, downloaded automatically when Valve ships an update | [`cs2/`](cs2/) |
| [crosshair.laine.lol](https://crosshair.laine.lol) | Converts CS2 crosshair share codes to console commands, with a preview | [`crosshair/`](crosshair/) |

---

## Architecture

```
                    visitor ── HTTPS ──▶ Cloudflare edge (TLS, bot challenge, caching)
                                               │
                                     Cloudflare Tunnel (outbound-only)
                                               │
┌─ host ───────────────────────────────────────┼─────────────────────────────────────┐
│  cloudflared (systemd) ─────▶ 127.0.0.1:80   ▼                                     │
│                                                                                    │
│  ┌─ docker compose ─────────────────────────────────────────────────────────────┐  │
│  │                                                                              │  │
│  │  web (nginx) ── routes by Host header ──┬──▶ static: laine.lol, crosshair    │  │
│  │     │                                   ├──▶ asf:1242   (ArchiSteamFarm)     │  │
│  │     │                                   ├──▶ bin:3000   (rustybin)           │  │
│  │     │                                   └──▶ cs2 UI + /files/ ◀─┐            │  │
│  │     │                                                           │ read-only  │  │
│  │     └─ cs2-data volume ◀── writes .7z builds ── watcher ────────┘            │  │
│  │                                                (polls steamcmd.net,          │  │
│  │                                                 DepotDownloader + 7z)        │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **cloudflared** runs on the host as a systemd service, not in compose. It forwards
  every hostname to the one nginx on `127.0.0.1:80`. Its config is at
  `/etc/cloudflared/config.yml`; a sanitized copy is in
  [`cloudflared/config.yml.example`](cloudflared/config.yml.example).
- **nginx (`web`)** is the only container with a published port, bound to
  `127.0.0.1` only. It serves the static sites, reverse-proxies `asf` and `bin` over
  the compose network, and serves the cs2 archive from a read-only volume.
- **asf** and **bin** publish no ports; only nginx can reach them.
- **watcher** writes CS2 builds into the `cs2-data` volume, and nginx serves them
  from there.

### Services (`docker-compose.yml`)

| Service | Image / build | Data | Notes |
| --- | --- | --- | --- |
| `web` | `./web` (nginx:alpine + `nginx.conf`) | bind-mounts `cs2/cs2-site`, `crosshair/crosshair-site`; `cs2-data` (ro) | Healthcheck hits `laine.lol` |
| `asf` | `justarchi/archisteamfarm:released` | `./asf/asf-config` | Config holds secrets (gitignored; see examples) |
| `bin` | `./bin/rustybin` (multi-stage Rust + Vite) | `bin-data` volume (SQLite) | Runs as uid 10001 |
| `watcher` | `./cs2/cs2-watcher` (python:3.12-slim + 7zip) | `cs2-data` volume | Config in `cs2/cs2.env` |

Every service caps its json-file logs at 3 × 10 MB (the `x-logging` anchor).

---

## Repository layout

```
.
├── docker-compose.yml          # the whole stack
├── .env.example                # → .env        (ADMIN_SECRET for bin)
├── cloudflared/
│   └── config.yml.example      # → /etc/cloudflared/config.yml
├── web/                        # shared nginx + the laine.lol landing page
│   ├── Dockerfile
│   ├── nginx.conf              # every vhost lives here
│   ├── security-headers.conf   # baseline headers, included by every vhost
│   └── index.html, styles.css, 404.html, 50x.html
├── asf/asf-config/             # ArchiSteamFarm config (real *.json are gitignored)
│   ├── ASF.json.example        # → ASF.json    (global config, IPC password)
│   ├── bot.json.example        # → <botname>.json (Steam login for one bot)
│   └── IPC.config              # Kestrel: listen on :1242, trust the compose network
├── bin/rustybin/               # pastebin (vendored fork of EternityX/rustybin, see below)
├── cs2/
│   ├── cs2.env.example         # → cs2.env     (Steam creds, webhook, tuning)
│   ├── cs2-watcher/            # Python watcher service (own README)
│   └── cs2-site/               # static listing UI for cs2.laine.lol
└── crosshair/crosshair-site/   # static crosshair-code converter
```

---

## Setting up from scratch

You need Docker with Compose v2, `cloudflared`, and a Cloudflare account that
manages `laine.lol`.

1. **Clone and create the secret files** from their examples (keep them `chmod 600`):

   ```bash
   git clone git@github.com:laine/laine.lol.git website && cd website
   cp .env.example .env                                   # set ADMIN_SECRET
   cp cs2/cs2.env.example cs2/cs2.env                     # Steam creds, webhook
   cp asf/asf-config/ASF.json.example asf/asf-config/ASF.json      # IPCPassword
   cp asf/asf-config/bot.json.example asf/asf-config/<bot>.json    # SteamLogin/Password
   chmod 600 .env cs2/cs2.env asf/asf-config/*.json
   ```

2. **Start the stack:**

   ```bash
   docker compose up -d --build
   docker compose ps          # all four services should report "healthy"
   ```

3. **One-time Steam login for the CS2 watcher.** This is interactive, for Steam Guard
   or 2FA. The session is saved in the `cs2-data` volume.

   ```bash
   docker compose run --rm watcher login
   ```

4. **Publish through Cloudflare Tunnel:**

   ```bash
   cloudflared tunnel login
   cloudflared tunnel create laine            # prints the tunnel id + writes credentials json
   sudo cp cloudflared/config.yml.example /etc/cloudflared/config.yml   # fill in <TUNNEL-ID>
   for h in laine.lol www.laine.lol asf.laine.lol bin.laine.lol cs2.laine.lol crosshair.laine.lol; do
     cloudflared tunnel route dns <TUNNEL-ID> "$h"
   done
   sudo cloudflared service install && sudo systemctl enable --now cloudflared
   ```

---

## Day-to-day operations

### Deploying changes

| You changed… | Run |
| --- | --- |
| `web/nginx.conf`, `web/security-headers.conf`, landing page | `docker compose run --rm --no-deps web nginx -t && docker compose up -d --build web` |
| `cs2/cs2-site/*`, `crosshair/crosshair-site/*` | Nothing to run: they're bind-mounted. Bump the `?v=` query strings in the page's `index.html` so browsers refetch. |
| `bin/rustybin/**` | `docker compose up -d --build bin` (Rust release build, takes a few minutes) |
| `cs2/cs2-watcher/**`, `cs2/cs2.env` | `docker compose up -d --build watcher` |
| `docker-compose.yml` | `docker compose config -q && docker compose up -d` |

The box has a small disk, so run `docker builder prune -f` after rebuilds.

### Adding a subdomain `X.laine.lol`

1. Add a `server { server_name X.laine.lol; … }` block to `web/nginx.conf`. Copy the
   `crosshair` block for a static site, or the `bin` block for a proxied service,
   and follow the [nginx conventions](#nginx-conventions).
2. If it's a static site, add a read-only bind mount for it to the `web` service in
   `docker-compose.yml`.
3. Add `- hostname: X.laine.lol` / `service: http://127.0.0.1:80` to
   `/etc/cloudflared/config.yml` *before* the catch-all 404. Back up the file first,
   then check it with `sudo cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate`.
4. `cloudflared tunnel route dns <TUNNEL-ID> X.laine.lol`, then `sudo systemctl restart cloudflared`.
5. Redeploy `web`.

### Health checks

Cloudflare's bot challenge returns **403 "Just a moment…"** to `curl` and other
headless clients on every hostname, even working ones. Test the origin directly
instead:

```bash
curl -sI -H "Host: X.laine.lol" http://127.0.0.1/
docker compose ps
```

### Useful commands

```bash
docker compose logs -f web                                  # nginx access log (real visitor IPs)
docker compose logs -f watcher                              # CS2 update checks
docker compose run --rm watcher once                        # one detect/download cycle
docker compose run --rm --no-deps watcher backfill          # recompress any leftover .zip builds to .7z
docker run --rm -v website_bin-data:/d alpine ls -la /d     # inspect the pastebin database files
```

---

## nginx conventions

[`web/nginx.conf`](web/nginx.conf) follows a few rules. Keep them when editing.

- **Never use `add_header` inside a `location`.** One `add_header` in a location
  silently drops every server-level header for that location. That once removed
  HSTS, CSP and X-Frame-Options from the whole landing page. Instead:
  - every server block `include`s [`security-headers.conf`](web/security-headers.conf)
    (HSTS, nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy) and
    adds its own `Content-Security-Policy`;
  - per-path `Cache-Control` comes from `map "$status:$uri"` variables at the top of
    `http {}`. Long-lived `immutable` caching only applies to 200/206/304 responses,
    so a 404 never gets stuck at Cloudflare's edge.
- **Real client IPs.** `real_ip_header CF-Connecting-IP` is trusted only from the
  Docker bridge and loopback, so `$remote_addr` is the real visitor IP. Rate
  limiting (`limit_req`/`limit_conn`, keyed on `$binary_remote_addr`) and the
  `X-Real-IP` / `X-Forwarded-For` sent to `asf` and `bin` both use it. bin's own
  per-IP API limits read `X-Real-IP`.
- **Unknown `Host` headers** hit a `default_server` that returns 444 (connection
  closed without a response).
- The variable `proxy_pass` + `resolver 127.0.0.11` pattern lets nginx start even
  when `asf` or `bin` is down, and re-resolves their IPs after restarts.
- `gzip` covers text types between nginx and the tunnel; Cloudflare re-compresses at
  its edge.

---

## The sites in detail

### laine.lol — [`web/`](web/)

A single static page with a strict CSP (`default-src 'self'`, no inline code) plus
COOP/COEP/CORP isolation headers.

### asf.laine.lol — [`asf/`](asf/)

The stock ArchiSteamFarm image; its web UI (IPC) listens on `:1242`. The UI can't be
edited, so nginx injects a small `<style>` via `sub_filter` that sets ASF-ui's
`--color-theme` variables to the site accent **`#C77F81`**. `Accept-Encoding ""`
upstream lets `sub_filter` see plain HTML. `IPC.config` trusts `X-Forwarded-For`
from the compose network, so ASF's failed-login bans hit the real visitor.

### bin.laine.lol — [`bin/rustybin/`](bin/rustybin/)

A **vendored copy** of [EternityX/rustybin](https://github.com/EternityX/rustybin),
taken from branch `003-foxybin-redesign` at commit `dc5d448`. Local changes on top:

- **Rebrand:** "lainebin" wordmark, the site accent color, favicon, and legal-page copy.
- **Backend fixes:**
  - Per-visitor rate limiting via `X-Real-IP`; the admin routes are rate-limited too.
  - Burn-after-read is atomic (single transaction).
  - A background job purges expired pastes every 5 minutes (indexed on `expires_at`).
  - The health check no longer depends on host-wide CPU.
  - Admin listings select `LENGTH(data)` instead of whole pastes.
  - SQLite `busy_timeout`/`synchronous=NORMAL`.

Pastes are encrypted in the browser (AES-GCM, key in the URL fragment), so the
server only stores ciphertext. See the project's own [README](bin/rustybin/README.md)
and [API_ENCRYPTION.md](bin/rustybin/API_ENCRYPTION.md).

> **Volume ownership gotcha:** the image runs as uid **10001**. Docker doesn't fix
> ownership on an existing named volume, so if the runtime UID ever changes, chown
> the volume during the swap:
> `docker compose stop bin && docker run --rm -v website_bin-data:/app/data alpine chown -R 10001:10001 /app/data && docker compose up -d bin`.
> Back up all three SQLite files together (`pastes.db`, `-wal`, `-shm`); most of
> the data lives in the WAL.

### cs2.laine.lol — [`cs2/`](cs2/)

- **Watcher** ([`cs2/cs2-watcher/`](cs2/cs2-watcher/), full docs in its
  [README](cs2/cs2-watcher/README.md)).
  - Every `POLL_INTERVAL` seconds it asks the login-free steamcmd.net API whether
    CS2's public build changed.
  - When it has, it signs in to Steam with DepotDownloader, downloads only the DLLs
    listed in `STEAM_FILES` (plus `cs2.exe`), and archives them as a **solid LZMA2
    `.7z`** named after the build date, e.g. `2026-09-24.7z`. That's about 28 MB per
    build, versus 61 MB as a deflate zip.
  - It can post Discord, Slack or generic webhooks.
  - Robustness:
    - checks free disk space before downloading;
    - retries a failing build with exponential backoff instead of logging in to
      Steam every poll;
    - kills a stuck download or archive step after a timeout;
    - writes to hidden `.NAME.part` files, which nginx refuses to serve, then
      renames them into place atomically;
    - cleans up on SIGTERM, and touches a heartbeat file that the compose
      healthcheck watches.
- **Site** ([`cs2/cs2-site/`](cs2/cs2-site/)): a static page that fetches nginx's
  JSON autoindex of `/files/` and renders a filterable, sortable list. Known CS2
  update names show up as labels.
- **Caching:** archive names are unique and never rewritten, so `/files/*` is served
  `immutable`. The listing is `no-store`. Old `/files/NAME.zip` links 301-redirect
  to `NAME.7z` after the recompression backfill.

### crosshair.laine.lol — [`crosshair/crosshair-site/`](crosshair/crosshair-site/)

Decodes CS2 crosshair share codes (`CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx`) entirely in
the browser. The page makes no network requests (`connect-src 'none'`).

- [`decode.js`](crosshair/crosshair-site/decode.js) turns the 25 base-57 characters
  into 18 bytes, then validates byte 0 (checksum over bytes 1–15) and byte 1
  (format version ≥ 3). It unpacks the style, outline, dot, T and recoil bits, the
  gap, thickness and length, the RGBA color, and the packed dynamic-split fields.
  The layout was taken from `client.dll`.
- The UI prints the settings as one line or one command per line (for
  `autoexec.cfg`), with a copy button. It draws a pixel-accurate static preview on
  a canvas.
- Share links look like `https://crosshair.laine.lol/#CSGO-…`.

The decoder also works as a CommonJS module, so it can be tested outside the browser:

```bash
bun -e 'const c = require("./crosshair/crosshair-site/decode.js");
        console.log(c.toCommands(c.decodeCrosshairCode("CSGO-vWXrO-j3eVj-mGMwj-6rryj-9PXzE")))'
```

---

## Secrets

These never get committed (see [`.gitignore`](.gitignore)). Each has an example file
next to it.

| File | Holds |
| --- | --- |
| `.env` | `ADMIN_SECRET` for the bin admin dashboard |
| `cs2/cs2.env` | Steam username/password, webhook URL |
| `asf/asf-config/*.json` | ASF IPC password, bot Steam logins |
| `/etc/cloudflared/*.json` | Tunnel credentials (outside the repo) |

Runtime state stays out of git too: ASF databases, the `bin-data` and `cs2-data`
volumes, and Steam session tokens.
