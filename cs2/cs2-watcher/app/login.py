"""One-time interactive Steam login (`python -m app login`).

DepotDownloader needs the Steam Guard / 2FA code typed in the *first* time. This
command performs a single login that downloads nothing (its filelist matches no
file) and stores the remembered session on the data volume, so the headless
watcher can download future builds without prompting.

Run it interactively, e.g.:

    docker compose run --rm watcher login

Exit codes: 0 = OK | 2 = rate-limited (try again later) | 3 = auth problem.
"""

from __future__ import annotations

import shutil

from . import config, depot
from .depot import die
from .steaminfo import fetch_build_info


def login() -> int:
    if not (config.STEAM_USER and config.STEAM_PASS):
        die("STEAM_USER and STEAM_PASS must be set (.env or environment).")

    exe = depot.ensure_depotdownloader()
    config.SESSION_DIR.mkdir(parents=True, exist_ok=True)

    # Probe the current build but match no files -> a real login, zero bytes.
    try:
        manifest = fetch_build_info(config.APPID, config.DEPOT, config.BRANCH).manifest
    except Exception:
        manifest = None  # fall back to "current build", still no bytes downloaded

    probe_dir = config.SESSION_DIR / ".probe"
    nomatch = config.SESSION_DIR / ".probe.filelist.txt"
    nomatch.write_text("regex:^__no_such_file__$\n", encoding="utf-8")

    print("Performing a one-time interactive Steam login.")
    print("Enter your Steam Guard / 2FA code when prompted. The session is stored")
    print("so the watcher can download future builds without prompting.\n")

    rc, out = depot.run_depotdownloader(
        exe, config.APPID, config.DEPOT, probe_dir,
        config.STEAM_USER, config.STEAM_PASS,
        filelist=nomatch, manifest=manifest, cwd=config.SESSION_DIR,
        stdin=None,  # inherit the terminal so Steam Guard can be typed
    )

    shutil.rmtree(probe_dir, ignore_errors=True)
    nomatch.unlink(missing_ok=True)

    print("\n" + "=" * 60)
    if depot._ratelimit_signal(out):
        print(">>> RATE-LIMITED right now. Wait ~15 minutes and try again.")
        return 2
    if rc == 0 or "licenses for account" in out.lower():
        print(">>> LOGIN OK. Session stored — start the watcher with `up -d`.")
        return 0
    if depot._auth_signal(out):
        print(">>> AUTH PROBLEM (wrong password / Steam Guard) — see output above.")
        return 3
    print(">>> Unclear result — read the DepotDownloader output above.")
    return 1
