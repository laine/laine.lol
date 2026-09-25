# cs2-update

**An updates-only detector + downloader for Steam builds, with webhook
notifications, packaged for Docker.**

It combines two earlier tools into one self-contained service:

- the **DepotDownloader pipeline** from *steam-depot-downloader* (find/auto-fetch
  DepotDownloader, log in, download a build's binaries, archive it by date), and
- the **build-archive web UI** from *cs2-site* (a dark, filterable list of the
  archived `.7z` files with download links).

Unlike the original "download every manifest" tool, this one **watches for new
builds and downloads only the ones it hasn't seen yet** — then fires a webhook so
you hear about every CS2 update the moment it lands.

```
   steamcmd.net (login-free)
        │
        │  poll: is there a new build?
        ▼
   ┌────────────────────────────────────────────────┐
   │  watcher (Docker)                              │
   │                                                │
   │  changed?  ──▶  DepotDownloader  ──▶  7z       │
   │                          │                     │
   │                          └──▶  webhook         │
   │                  (Discord / Slack / generic)   │
   └────────────────────────────────────────────────┘
        │
        ▼  writes
   /data/downloads/*.7z
        │
        ▼  served by
   web (nginx)  ──▶  http://localhost:8080
```

## How it detects updates

Detection uses the **login-free** [steamcmd.net](https://www.steamcmd.net/) app-info
mirror to read the current public manifest/build id for the depot. Because no Steam
login is involved, the watcher can poll frequently without ever tripping Steam's
login rate limit. A **Steam login happens only when a change is detected** and the
new build is actually downloaded — so logins are rare (one per real game update).

The last archived build is recorded in `data/state.json`, so restarts resume
cleanly and each build is downloaded exactly once.

## Quick start

```bash
cp .env.example .env          # then edit: Steam creds + (optional) webhook URL

# One-time interactive Steam login (type your Steam Guard / 2FA code).
# The remembered session is stored on the ./data volume.
docker compose run --rm watcher login

# Start the watcher + web UI.
docker compose up -d
docker compose logs -f watcher
```

Browse and download archived builds at **http://localhost:8080**
(change the port with `WEB_PORT` in `.env`).

> ⚠️ DepotDownloader signs in **as you** and pulls depots through **your own Steam
> licenses** — this only works for apps your account owns.

## Configuration (`.env`)

| Variable                   | Default                | Meaning                                                        |
| -------------------------- | ---------------------- | -------------------------------------------------------------- |
| `STEAM_USER` / `STEAM_PASS`| —                      | Steam account (needed to **download**; detection is login-free). The password is only used by `login`; downloads sign in with the saved session token, so it never appears on a command line |
| `STEAM_APPID`              | `730`                  | App to watch (730 = CS2)                                        |
| `STEAM_DEPOT`              | `2347771`              | Depot to watch (CS2 win64 binaries)                            |
| `STEAM_BRANCH`             | `public`               | Branch to watch                                                |
| `STEAM_FILES`              | CS2 DLLs + `cs2.exe`   | Basenames to keep per build (comma-separated). Empty = whole depot |
| `POLL_INTERVAL`            | `300`                  | Seconds between update checks                                  |
| `COMPRESSION`              | `7z`                   | `7z` = solid LZMA2 `.7z` (~54% smaller than deflate); or a `.zip` with `deflate` (Explorer-friendly) / `lzma` / `bzip2` / `store` |
| `SEVENZIP_THREADS`         | `2`                    | Threads for the 7z compressor                                  |
| `DOWNLOAD_TIMEOUT` / `ARCHIVE_TIMEOUT` | `3600` / `1800` | Seconds before a stuck DepotDownloader / 7z run is killed (0 = never) |
| `MIN_FREE_MB`              | `2048`                 | Skip downloads (and report `failed`) when free space is below this |
| `MAX_RETRY_BACKOFF`        | `21600`                | Cap for the exponential back-off between retries of a failed build |
| `MAX_ARCHIVE_GB`           | `0` (off)              | After each new build, delete the oldest archives until `downloads/` fits in this many GB |
| `DOWNLOAD_LATEST_ON_START` | `true`                 | Archive the current build on first run, then only new ones      |
| `WEBHOOK_URL`              | — (disabled)           | Discord / Slack / generic JSON endpoint                        |
| `WEBHOOK_FORMAT`           | `auto`                 | `auto` / `discord` / `slack` / `generic`                       |
| `WEBHOOK_EVENTS`           | all four               | Subset of `startup,detected,completed,failed`                  |
| `PUBLIC_BASE_URL`          | `http://localhost:8080`| Used to build download links inside notifications              |
| `WEB_PORT`                 | `8080`                 | Host port for the web UI                                       |

## Webhook notifications

Set `WEBHOOK_URL` to enable. The format is auto-detected from the URL:

- **Discord** (`.../api/webhooks/...`) — a rich embed per event, colour-coded.
- **Slack** (`hooks.slack.com/...`) — a simple formatted message.
- **generic** (anything else) — a JSON POST:

  ```json
  {
    "event": "completed",
    "title": "CS2 build archived",
    "message": "Saved 2026-06-14.7z (29 files, 28.15 MB).",
    "fields": { "Build": "...", "Manifest": "...", "Size": "28.15 MB" },
    "url": "http://localhost:8080/files/2026-06-14.7z",
    "app": 730, "depot": 2347771, "branch": "public",
    "timestamp": "2026-06-14T00:00:00+00:00"
  }
  ```

Events: `startup` (watcher came online), `detected` (new build found, download
starting), `completed` (archived, includes the download link), `failed` (download
problem — e.g. an expired session, with a hint to re-run `login`).

## Commands

The watcher image takes one argument (default `watch`):

```bash
docker compose run --rm watcher login    # one-time interactive Steam login
docker compose run --rm watcher once     # single detect/download cycle, then exit
docker compose run --rm --no-deps watcher backfill  # recompress old .zip archives to .7z
docker compose up -d                      # default: the continuous watch loop
```

## Data layout (`./data`, a Docker volume)

```
data/
├── downloads/            # the archived .7z builds  (served by the web UI at /files/)
│   ├── 2026-06-12.7z
│   └── 2026-06-14.7z
├── tools/DepotDownloader/  # auto-downloaded self-contained binary
├── session/              # remembered Steam login (from `login`)
└── state.json            # last archived build per app/depot/branch
```

## Running without Docker

It's pure Python 3.9+ stdlib (no `pip install`). Point `DATA_DIR` somewhere
writable and run the module:

```bash
export DATA_DIR=./data
python -m app login     # one-time
python -m app watch     # or `once`
```

Serve `web/` with the downloads mounted at `web/files/` behind any static server
that supports JSON directory listing (nginx config provided in `nginx.conf`).

## Troubleshooting

- **Downloads fail with an auth/session error** — the remembered session expired.
  Re-run `docker compose run --rm watcher login`. The watcher keeps polling and
  webhooks a `failed` event so you know.
- **`RateLimitExceeded`** — Steam throttled a login. The watcher backs off and
  retries automatically; if you hit it during `login`, wait ~15 minutes.
- **Detection returns nothing** — steamcmd.net may be briefly unavailable; the
  watcher logs it and retries on the next poll. Override the endpoint with
  `STEAMCMD_API` if needed.
- **"does not own the app"** — sign in with an account that owns the app.

## Image notes

- **DepotDownloader is pinned** (`DEPOTDOWNLOADER_VERSION` / `DEPOTDOWNLOADER_SHA256`
  build args in the `Dockerfile`), verified by checksum and installed at
  `/opt/depotdownloader`. The runtime "download latest" code is only a fallback
  when it isn't on `PATH`.
- **Runs as uid 10001.** A `/data` volume created by an older root image needs a
  one-time `chown`, with the watcher stopped:
  `docker run --rm -v website_cs2-data:/d alpine chown -R 10001:10001 /d`.
- **Saved Steam session and the binary's path.** DepotDownloader keeps its login
  token in .NET IsolatedStorage under
  `/data/.local/share/IsolatedStorage/…/Url.<hash>/AssemFiles/account.config`.
  The `<hash>` is derived from the **path of the DepotDownloader executable**. If
  the binary moves, it can't find the token. Either copy `account.config` into
  the new `Url.*` directory, which appears after one run, or run `login` again.
