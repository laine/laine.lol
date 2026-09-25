"""The update-only watcher: detect -> download the new build -> archive -> notify.

State (the last build we've archived per app/depot/branch) lives in STATE_FILE so
restarts resume cleanly and a build is only ever downloaded once. Detection is
login-free (steaminfo); a Steam login happens only when a change is found.
"""

from __future__ import annotations

import json
import shutil
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from . import config, depot, webhook
from .depot import human_size, log
from .steaminfo import BuildInfo, fetch_build_info


# --------------------------------------------------------------------------- #
# State (last archived build per app/depot/branch)
# --------------------------------------------------------------------------- #

def _state_key() -> str:
    return f"{config.APPID}/{config.DEPOT}/{config.BRANCH}"


def load_state() -> dict:
    try:
        return json.loads(config.STATE_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return {}


def save_state(state: dict) -> None:
    config.STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = config.STATE_FILE.with_name(config.STATE_FILE.name + ".part")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp.replace(config.STATE_FILE)


# --------------------------------------------------------------------------- #
# Naming + download
# --------------------------------------------------------------------------- #

ARCHIVE_EXTS = (".7z", ".zip")


def _taken(base: str) -> bool:
    """Whether an archive with this base name exists in any format (older builds
    may still be .zip)."""
    return any((config.DOWNLOADS_DIR / f"{base}{ext}").exists() for ext in ARCHIVE_EXTS)


def _archive_name(info: BuildInfo) -> str:
    """Name the archive by the build's UTC date (web-UI friendly:
    YYYY-MM-DD.7z, or YYYY-MM-DD_HH-MM-SS.7z if that date already exists).
    Never overwrites an existing archive."""
    ext = depot.archive_ext(config.COMPRESSION)
    if info.timeupdated:
        dt = datetime.fromtimestamp(info.timeupdated, tz=timezone.utc)
        base = dt.strftime("%Y-%m-%d")
        if _taken(base):
            base = dt.strftime("%Y-%m-%d_%H-%M-%S")
    else:
        base = f"build-{info.buildid or info.manifest}"
    unique, n = base, 2
    while _taken(unique):
        unique, n = f"{base}_{n}", n + 1
    return f"{unique}{ext}"


def prune_archives(keep: Path) -> None:
    """Enforce MAX_ARCHIVE_GB by deleting the oldest archives (names sort by
    date). Never deletes `keep`, the archive that was just written."""
    if config.MAX_ARCHIVE_GB <= 0:
        return
    limit = config.MAX_ARCHIVE_GB * 1024 ** 3
    archives = sorted(p for p in config.DOWNLOADS_DIR.iterdir()
                      if p.suffix in ARCHIVE_EXTS and not p.name.startswith("."))
    total = sum(p.stat().st_size for p in archives)
    for p in archives:
        if total <= limit:
            break
        if p == keep:
            continue
        size = p.stat().st_size
        p.unlink()
        total -= size
        log(f"retention: deleted {p.name} ({human_size(size)}); "
            f"archive now {human_size(total)} / {config.MAX_ARCHIVE_GB} GB")


def _build_filelist():
    if not config.FILES:
        return None
    return depot.build_filelist(config.FILES, config.FILELIST_FILE)


class Download:
    """Result of one download attempt."""

    def __init__(self, path: Path | None = None, n_files: int = 0,
                 size: int = 0, error: str | None = None):
        self.path = path
        self.n_files = n_files
        self.size = size
        self.error = error

    @property
    def ok(self) -> bool:
        return self.error is None and self.path is not None


def download_build(exe: Path, info: BuildInfo, filelist: Path | None) -> Download:
    """Download exactly `info`'s manifest, keep wanted files, archive them.

    Retries with back-off only on Steam *login* rate limiting; auth/ownership
    failures return immediately so the watcher can surface them via webhook.
    The staging dir is always removed, whatever happens.
    """
    config.DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

    free_mb = shutil.disk_usage(config.DOWNLOADS_DIR).free // (1024 * 1024)
    if free_mb < config.MIN_FREE_MB:
        return Download(error=f"low disk space ({free_mb} MB free, "
                              f"need {config.MIN_FREE_MB} MB)")

    try:
        return _download_and_archive(exe, info, filelist)
    finally:
        shutil.rmtree(config.STAGING_DIR, ignore_errors=True)


def _download_and_archive(exe: Path, info: BuildInfo, filelist: Path | None) -> Download:
    staging = config.STAGING_DIR
    rc, output, rl = 1, "", 0
    while True:
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)
        rc, output = depot.run_depotdownloader(
            exe, config.APPID, config.DEPOT, staging,
            config.STEAM_USER, None,   # session token only; see run_depotdownloader
            filelist=filelist, manifest=info.manifest, cwd=config.SESSION_DIR,
        )
        if rc == 0 or not depot._ratelimit_signal(output):
            break
        rl += 1
        if rl > config.MAX_RATELIMIT_RETRIES:
            return Download(error="rate-limited (gave up after back-off)")
        wait = config.RATELIMIT_COOLDOWN * rl
        log(f"  Steam login rate-limited; backing off {wait}s "
            f"(retry {rl}/{config.MAX_RATELIMIT_RETRIES})...")
        time.sleep(wait)

    if rc != 0:
        if "[watcher] download timed out" in output:
            return Download(error=f"timed out after {config.DOWNLOAD_TIMEOUT}s")
        auth = depot._auth_signal(output)
        if auth:
            return Download(error=f"auth/session ({auth})")
        own = depot._ownership_signal(output)
        if own:
            return Download(error=f"ownership ({own})")
        return Download(error=f"DepotDownloader exited {rc}")

    files = [p for p in staging.rglob("*")
             if p.is_file() and ".DepotDownloader" not in p.parts]
    if not files:
        return Download(error="no matching files in this build")

    dest = config.DOWNLOADS_DIR / _archive_name(info)
    try:
        size = depot.archive_build(staging, dest, config.COMPRESSION)
    except Exception as e:  # noqa: BLE001 -- disk full, 7z failure, timeout...
        return Download(error=f"archiving failed: {e}")
    return Download(path=dest, n_files=len(files), size=size)


# --------------------------------------------------------------------------- #
# One detect/download cycle
# --------------------------------------------------------------------------- #

def _download_link(path: Path) -> str | None:
    if not config.PUBLIC_BASE_URL:
        return None
    return f"{config.PUBLIC_BASE_URL}/files/{path.name}"


def check_once(state: dict, exe: Path, filelist: Path | None,
               announced: dict) -> bool:
    """Run one detect -> (maybe) download cycle. `announced` carries dedup keys
    and the retry back-off across polls, so a stuck build neither spams the webhook
    nor signs in to Steam every poll. Returns True if a new build was successfully
    archived this cycle."""
    key = _state_key()
    seen = BuildInfo.from_dict(state.get(key))

    try:
        info = fetch_build_info(config.APPID, config.DEPOT, config.BRANCH)
    except Exception as e:  # noqa: BLE001
        log(f"detect: could not query build info: {e}")
        return False

    if not info.key:
        log("detect: API returned no manifest/build id; will retry.")
        return False

    if seen is None:
        # First time we've ever seen this app/depot/branch.
        if not config.DOWNLOAD_LATEST_ON_START:
            log(f"baseline set: build {info.buildid} (manifest {info.manifest}); "
                "watching for future changes only.")
            state[key] = info.as_dict()
            save_state(state)
            return False
        log(f"first run: archiving current build {info.buildid} "
            f"(manifest {info.manifest}).")
    elif info.key == seen.key:
        log(f"no change (build {info.buildid}, manifest {info.manifest}).")
        return False
    else:
        log(f"NEW BUILD: {seen.key} -> {info.key} "
            f"(build {info.buildid}, manifest {info.manifest}).")

    # Back off after failures of this same build (exponential, capped).
    retry = announced.get("retry")
    if retry and retry["key"] == info.key and time.time() < retry["next"]:
        log(f"retry back-off: next attempt for build {info.buildid} in "
            f"{int(retry['next'] - time.time())}s.")
        return False

    # Announce detection once per distinct build.
    if announced.get("detected") != info.key:
        webhook.notify(
            "detected",
            title="New CS2 build detected",
            message=f"Build `{info.buildid}` (manifest `{info.manifest}`) is live. "
                    "Downloading…",
            fields={"App": config.APPID, "Depot": config.DEPOT,
                    "Build": info.buildid or "—"},
        )
        announced["detected"] = info.key

    if not config.STEAM_USER:
        msg = "STEAM_USER not set — cannot download. Set STEAM_USER/STEAM_PASS " \
              "and run the one-time `login` command."
        log(f"download skipped: {msg}")
        if announced.get("failed") != info.key:
            webhook.notify("failed", title="CS2 build download skipped",
                           message=msg, fields={"Build": info.buildid or "—"})
            announced["failed"] = info.key
        return False

    result = download_build(exe, info, filelist)

    if not result.ok:
        n = retry["n"] + 1 if retry and retry["key"] == info.key else 1
        delay = min(config.POLL_INTERVAL * 2 ** n, config.MAX_RETRY_BACKOFF)
        announced["retry"] = {"key": info.key, "n": n, "next": time.time() + delay}
        log(f"download failed: {result.error} (attempt {n}; retrying in {delay}s)")
        if announced.get("failed") != info.key:
            extra = (" Run the one-time `login` command to refresh the Steam Guard "
                     "session." if result.error and "auth" in result.error else "")
            webhook.notify(
                "failed",
                title="CS2 build download failed",
                message=f"Build `{info.buildid}` could not be downloaded: "
                        f"{result.error}.{extra}",
                fields={"Build": info.buildid or "—", "Reason": result.error},
            )
            announced["failed"] = info.key
        return False  # state not advanced -> retried next poll

    # Success: record it first (so a crash can't cause a re-download), then notify.
    state[key] = info.as_dict()
    save_state(state)
    announced.pop("detected", None)
    announced.pop("failed", None)
    announced.pop("retry", None)

    path = result.path
    link = _download_link(path)
    log(f"archived {path.name} ({result.n_files} files, {human_size(result.size)})")
    try:
        prune_archives(keep=path)
    except OSError as e:
        log(f"retention: could not prune old archives: {e}")
    webhook.notify(
        "completed",
        title="CS2 build archived",
        message=f"Saved **{path.name}** "
                f"({result.n_files} files, {human_size(result.size)}).",
        fields={"Build": info.buildid or "—",
                "Manifest": info.manifest or "—",
                "Size": human_size(result.size)},
        url=link,
    )
    return True


# --------------------------------------------------------------------------- #
# Entry points
# --------------------------------------------------------------------------- #

def _prepare() -> tuple[Path, Path | None]:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    exe = depot.ensure_depotdownloader()
    return exe, _build_filelist()


def run_once() -> int:
    """Single detect/download cycle (handy for cron-style scheduling)."""
    exe, filelist = _prepare()
    state = load_state()
    archived = check_once(state, exe, filelist, announced={})
    return 0 if archived else 0  # detection success regardless of "new" or not


def watch() -> int:
    """Long-running poll loop (the default Docker command)."""
    log(f"cs2-update watcher: app {config.APPID}, depot {config.DEPOT}, "
        f"branch '{config.BRANCH}', every {config.POLL_INTERVAL}s.")
    log(f"downloads -> {config.DOWNLOADS_DIR}")
    if config.FILES:
        log(f"keeping {len(config.FILES)} file pattern(s) per build.")
    else:
        log("keeping ALL files in the depot (STEAM_FILES is empty).")
    if not config.STEAM_USER:
        log("WARNING: STEAM_USER not set — detection works, but downloads will "
            "be skipped until credentials + `login` are provided.")

    exe, filelist = _prepare()
    state = load_state()
    seen = BuildInfo.from_dict(state.get(_state_key()))

    webhook.notify(
        "startup",
        title="CS2 update watcher online",
        message=f"Watching app {config.APPID}, depot {config.DEPOT} "
                f"('{config.BRANCH}') every {config.POLL_INTERVAL}s.",
        fields={"Last archived build": (seen.buildid if seen else None) or "—"},
    )

    # `docker compose down` sends SIGTERM: exit via SystemExit so the finally
    # blocks run (staging cleanup, killing a running DepotDownloader).
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))

    announced: dict = {}
    config.HEARTBEAT_FILE.touch()
    while True:
        try:
            check_once(state, exe, filelist, announced)
        except Exception as e:  # noqa: BLE001 -- keep the loop alive no matter what
            log(f"unexpected error this cycle: {e!r}")
        # Liveness signal for the compose healthcheck.
        config.HEARTBEAT_FILE.touch()
        time.sleep(config.POLL_INTERVAL)
