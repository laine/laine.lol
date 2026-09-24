"""Central configuration, read once from the environment (and an optional .env).

Real environment variables always win over .env, so Docker's `env_file` / compose
`environment:` overrides work as expected. Everything the watcher needs is here so
the rest of the package never touches os.environ directly.
"""

from __future__ import annotations

import os
from pathlib import Path


# --------------------------------------------------------------------------- #
# .env loading (minimal, stdlib-only -- mirrors the original downloader)
# --------------------------------------------------------------------------- #

def _load_dotenv(path: Path) -> None:
    """Load KEY=VALUE lines from `path`. Existing env vars are never overwritten."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.lower().startswith("export "):
            line = line[len("export "):].strip()
        if "=" not in line:
            continue
        key, val = (s.strip() for s in line.split("=", 1))
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
            val = val[1:-1]
        if key and key not in os.environ:
            os.environ[key] = val


# Look for a .env in the current dir and next to the repo root (handy for local
# runs). In Docker the values come from the compose env_file instead.
for _p in (Path.cwd() / ".env", Path(__file__).resolve().parent.parent / ".env"):
    _load_dotenv(_p)


# --------------------------------------------------------------------------- #
# Typed getters
# --------------------------------------------------------------------------- #

def _str(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _int(name: str, default: int) -> int:
    try:
        return int((os.environ.get(name) or "").strip() or default)
    except ValueError:
        return default


def _bool(name: str, default: bool = False) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _list(name: str) -> list[str]:
    return [x.strip() for x in os.environ.get(name, "").split(",") if x.strip()]


# --------------------------------------------------------------------------- #
# Paths -- everything persistent lives under DATA_DIR (a Docker volume).
# --------------------------------------------------------------------------- #

DATA_DIR = Path(_str("DATA_DIR", "data"))
DOWNLOADS_DIR = Path(_str("DOWNLOADS_DIR", str(DATA_DIR / "downloads")))
TOOLS_DIR = Path(_str("TOOLS_DIR", str(DATA_DIR / "tools" / "DepotDownloader")))
SESSION_DIR = Path(_str("SESSION_DIR", str(DATA_DIR / "session")))
STATE_FILE = Path(_str("STATE_FILE", str(DATA_DIR / "state.json")))
FILELIST_FILE = DATA_DIR / ".filelist.txt"
STAGING_DIR = DATA_DIR / ".staging"

# --------------------------------------------------------------------------- #
# What to watch
# --------------------------------------------------------------------------- #

STEAM_USER = _str("STEAM_USER")
STEAM_PASS = _str("STEAM_PASS")

APPID = _int("STEAM_APPID", 730)            # 730 = CS2
DEPOT = _int("STEAM_DEPOT", 2347771)        # win64 binaries depot
BRANCH = _str("STEAM_BRANCH", "public") or "public"

# Basenames to keep from each build (matched at the end of a path in ANY
# subdirectory). Empty list => download the whole depot.
FILES = _list("STEAM_FILES")

# --------------------------------------------------------------------------- #
# Behaviour
# --------------------------------------------------------------------------- #

POLL_INTERVAL = _int("POLL_INTERVAL", 300)            # seconds between checks
COMPRESSION = _str("COMPRESSION", "7z").lower()        # 7z (solid LZMA2) | deflate|lzma|bzip2|store (.zip)
SEVENZIP_THREADS = _int("SEVENZIP_THREADS", 2)
DOWNLOAD_LATEST_ON_START = _bool("DOWNLOAD_LATEST_ON_START", True)

# Safety limits. A download/archive that runs past its timeout is killed and
# counted as a failure; 0 disables a timeout.
DOWNLOAD_TIMEOUT = _int("DOWNLOAD_TIMEOUT", 3600)     # seconds, DepotDownloader run
ARCHIVE_TIMEOUT = _int("ARCHIVE_TIMEOUT", 1800)       # seconds, 7z run
MIN_FREE_MB = _int("MIN_FREE_MB", 2048)               # skip downloads below this free space
# Failed downloads of the same build are retried with exponential back-off
# (POLL_INTERVAL * 2^n, capped here) instead of a fresh Steam login every poll.
MAX_RETRY_BACKOFF = _int("MAX_RETRY_BACKOFF", 6 * 3600)
HEARTBEAT_FILE = DATA_DIR / ".heartbeat"

# DepotDownloader throttling / back-off (same knobs the original tool used).
MAX_SERVERS = _int("MAX_SERVERS", 8)
MAX_DOWNLOADS = _int("MAX_DOWNLOADS", 4)
RATELIMIT_COOLDOWN = _int("RATELIMIT_COOLDOWN", 90)
MAX_RATELIMIT_RETRIES = _int("MAX_RATELIMIT_RETRIES", 8)

# --------------------------------------------------------------------------- #
# Detection API (login-free). steamcmd.net mirrors Steam's PICS app info.
# --------------------------------------------------------------------------- #

STEAMCMD_API = _str("STEAMCMD_API", "https://api.steamcmd.net/v1/info").rstrip("/")

# --------------------------------------------------------------------------- #
# Webhook notifications
# --------------------------------------------------------------------------- #

WEBHOOK_URL = _str("WEBHOOK_URL")
WEBHOOK_FORMAT = _str("WEBHOOK_FORMAT", "auto").lower()   # auto|discord|slack|generic
WEBHOOK_EVENTS = [e.lower() for e in _list("WEBHOOK_EVENTS")] or \
    ["startup", "detected", "completed", "failed"]
# Public base URL of the web UI, used to build download links in notifications,
# e.g. "https://cs2.example.com" -> ".../files/2026-06-14.zip".
PUBLIC_BASE_URL = _str("PUBLIC_BASE_URL").rstrip("/")
