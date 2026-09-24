"""One-off: recompress existing .zip archives in DOWNLOADS_DIR into solid .7z.

    docker compose run --rm --no-deps watcher backfill

Safe to interrupt and re-run: each archive is extracted to a scratch dir, packed
into a hidden .part file, tested, atomically renamed to NAME.7z (keeping the zip's
mtime), and only then is NAME.zip deleted. A NAME.7z that already exists is a
finished conversion (the rename is atomic), so its leftover zip is just removed.
Old /files/NAME.zip links keep working via an nginx redirect to NAME.7z.
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time

from . import config, depot
from .depot import human_size, log


def _convert(zip_path, scratch) -> tuple[int, int]:
    dest = zip_path.with_suffix(".7z")
    tmp = depot.part_path(dest)
    shutil.rmtree(scratch, ignore_errors=True)
    scratch.mkdir(parents=True)
    try:
        # 7z extraction keeps the files' original mtimes (zipfile would not).
        subprocess.run(["nice", "-n", "15", "7z", "x", "-bso0", "-bsp0", "-y",
                        f"-o{scratch}", str(zip_path)], check=True)
        depot.sevenzip(scratch, tmp)
        subprocess.run(["7z", "t", "-bso0", "-bsp0", str(tmp)], check=True)
        st = zip_path.stat()
        os.chmod(tmp, 0o644)
        os.utime(tmp, (st.st_atime, st.st_mtime))
        os.replace(tmp, dest)
        zip_path.unlink()
        return st.st_size, dest.stat().st_size
    finally:
        tmp.unlink(missing_ok=True)
        shutil.rmtree(scratch, ignore_errors=True)


def backfill() -> int:
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    scratch = config.DATA_DIR / ".backfill"
    zips = sorted(p for p in config.DOWNLOADS_DIR.glob("*.zip") if not p.name.startswith("."))
    log(f"backfill: {len(zips)} zip archive(s) to convert in {config.DOWNLOADS_DIR}")

    before = after = done = 0
    for i, zp in enumerate(zips, 1):
        if zp.with_suffix(".7z").exists():
            log(f"[{i}/{len(zips)}] {zp.name}: .7z already exists, removing zip")
            zp.unlink()
            continue
        t = time.time()
        try:
            old, new = _convert(zp, scratch)
        except Exception as e:  # noqa: BLE001 -- skip it, keep going
            log(f"[{i}/{len(zips)}] {zp.name}: FAILED ({e}); left untouched")
            continue
        before, after, done = before + old, after + new, done + 1
        log(f"[{i}/{len(zips)}] {zp.name}: {human_size(old)} -> {human_size(new)} "
            f"in {time.time() - t:.0f}s (saved {human_size(before - after)} so far)")

    log(f"backfill done: {done} converted, {human_size(before)} -> {human_size(after)}")
    return 0
