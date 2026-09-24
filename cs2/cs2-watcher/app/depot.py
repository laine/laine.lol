"""DepotDownloader acquisition, execution, filelist and archiving.

This is the proven download pipeline from the original `steam_build_inventory.py`,
factored into reusable helpers and adapted for headless/Docker use:

* DepotDownloader is found on PATH, in TOOLS_DIR, or auto-downloaded (the
  self-contained release needs no .NET install).
* `run_depotdownloader` streams output live, hides per-chunk retry spam, and (for
  the interactive `login` command) keeps stdin attached for the Steam Guard prompt.
  In the headless watcher stdin is /dev/null so a missing session fails fast instead
  of hanging, and the watcher reports it via a webhook.
"""

from __future__ import annotations

import os
import platform
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import threading
import urllib.error
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path

from . import config

GITHUB_LATEST = "https://api.github.com/repos/SteamRE/DepotDownloader/releases/latest"
EXE_NAME = "DepotDownloader.exe" if os.name == "nt" else "DepotDownloader"

# Archive formats. "7z" (the default) is a solid LZMA2 .7z built with the 7-Zip CLI:
# about half the size of a deflate .zip for CS2's DLLs (e.g. 28 MB vs 61 MB), because
# a solid archive compresses the redundancy shared across the DLLs as one stream.
# The rest are .zip via the stdlib.
SEVENZIP = "7z"
COMPRESSION = {
    "lzma": (zipfile.ZIP_LZMA, None),
    "bzip2": (zipfile.ZIP_BZIP2, None),
    "deflate": (zipfile.ZIP_DEFLATED, 6),   # Explorer-friendly "Extract All"
    "store": (zipfile.ZIP_STORED, None),
}


# --------------------------------------------------------------------------- #
# Tiny helpers
# --------------------------------------------------------------------------- #

def log(msg: str) -> None:
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


def die(msg: str, code: int = 1) -> "NoReturn":  # type: ignore[name-defined]
    print(f"\nERROR: {msg}", file=sys.stderr, flush=True)
    raise SystemExit(code)


def human_size(num: int) -> str:
    size = float(num)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024 or unit == "TB":
            return f"{int(size)} {unit}" if unit == "B" else f"{size:.2f} {unit}"
        size /= 1024
    return f"{num} B"


# --------------------------------------------------------------------------- #
# DepotDownloader acquisition (PATH -> TOOLS_DIR -> download latest release)
# --------------------------------------------------------------------------- #

def detect_platform() -> tuple[str, str]:
    sysname = platform.system().lower()
    if sysname.startswith("win"):
        os_key = "windows"
    elif sysname == "darwin":
        os_key = "macos"
    elif sysname == "linux":
        os_key = "linux"
    else:
        die(f"Unsupported OS: {platform.system()}")

    machine = platform.machine().lower()
    if machine in ("amd64", "x86_64", "x64"):
        arch_key = "x64"
    elif machine in ("arm64", "aarch64"):
        arch_key = "arm64"
    else:
        die(f"Unsupported CPU architecture: {platform.machine()}")
    return os_key, arch_key


def _http_get(url: str, accept_json: bool = False) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "cs2-update-watcher"})
    if accept_json:
        req.add_header("Accept", "application/vnd.github+json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        die(f"HTTP {e.code} fetching {url}: {e.reason}")
    except urllib.error.URLError as e:
        die(f"Network error fetching {url}: {e.reason}")


def _pick_asset(assets: list[dict], os_key: str, arch_key: str) -> dict | None:
    candidates = [a for a in assets
                  if a["name"].lower().endswith((".zip", ".tar.gz", ".tgz"))]
    matches = [a for a in candidates
               if os_key in a["name"].lower() and arch_key in a["name"].lower()]
    if matches:
        return matches[0]
    return candidates[0] if candidates else None


def find_existing_depotdownloader() -> Path | None:
    on_path = shutil.which("DepotDownloader") or shutil.which("depotdownloader")
    if on_path:
        return Path(on_path)
    local = config.TOOLS_DIR / EXE_NAME
    return local if local.exists() else None


def download_depotdownloader() -> Path:
    import json
    os_key, arch_key = detect_platform()
    log(f"DepotDownloader not found; fetching latest release for {os_key}/{arch_key}...")
    data = json.loads(_http_get(GITHUB_LATEST, accept_json=True))
    asset = _pick_asset(data.get("assets", []), os_key, arch_key)
    if not asset:
        die("Could not find a suitable DepotDownloader asset in the latest release.")

    log(f"Release {data.get('tag_name', '?')} -> {asset['name']}")
    config.TOOLS_DIR.mkdir(parents=True, exist_ok=True)
    archive_path = config.TOOLS_DIR / asset["name"]
    archive_path.write_bytes(_http_get(asset["browser_download_url"]))

    name = asset["name"].lower()
    if name.endswith(".zip"):
        with zipfile.ZipFile(archive_path) as zf:
            zf.extractall(config.TOOLS_DIR)
    elif name.endswith((".tar.gz", ".tgz")):
        with tarfile.open(archive_path) as tf:
            tf.extractall(config.TOOLS_DIR, filter="data")
    else:
        die(f"Don't know how to extract {asset['name']}")
    archive_path.unlink(missing_ok=True)

    exe = config.TOOLS_DIR / EXE_NAME
    if not exe.exists():
        exe = next((p for p in config.TOOLS_DIR.rglob(EXE_NAME)), None)
        if not exe:
            die(f"DepotDownloader binary ({EXE_NAME}) not found after extraction.")
    if os.name != "nt":
        exe.chmod(exe.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    log(f"DepotDownloader ready: {exe}")
    return exe


def ensure_depotdownloader() -> Path:
    existing = find_existing_depotdownloader()
    if existing:
        log(f"Using DepotDownloader: {existing}")
        return existing
    return download_depotdownloader()


# --------------------------------------------------------------------------- #
# Running DepotDownloader (streamed live; output captured for signal detection)
# --------------------------------------------------------------------------- #

def _is_chunk_noise(line: str) -> bool:
    low = line.lstrip().lower()
    return (low.startswith("encountered error downloading chunk")
            or low.startswith("connection timeout downloading chunk"))


def _stream_reader(pipe, sink_file, buf: list[str], drop=None) -> None:
    line: list[str] = []
    try:
        while True:
            ch = pipe.read(1)
            if not ch:
                break
            buf.append(ch)
            if ch == "\n":
                text = "".join(line)
                line = []
                if drop and drop(text):
                    continue
                sink_file.write(text + "\n")
                sink_file.flush()
            else:
                line.append(ch)
                if ch == " " and line[-2:] == [":", " "]:
                    sink_file.write("".join(line))
                    sink_file.flush()
                    line = []
        if line:
            text = "".join(line)
            if not (drop and drop(text)):
                sink_file.write(text)
                sink_file.flush()
    finally:
        try:
            pipe.close()
        except Exception:
            pass


def _ownership_signal(output: str) -> str | None:
    low = output.lower()
    for sig in ("no licenses", "does not own", "not available for account",
                "invalid app", "app is not available"):
        if sig in low:
            return sig
    return None


def _auth_signal(output: str) -> str | None:
    """A genuine sign-in / Steam Guard failure -- the session needs `login` again."""
    low = output.lower()
    for sig in ("invalid password", "two-factor code mismatch",
                "no code was provided", "failed to authenticate with steam",
                "two factor", "invalidpassword", "expired", "loginid"):
        if sig in low:
            return sig
    return None


def _ratelimit_signal(output: str) -> bool:
    return "ratelimitexceeded" in output.lower()


def run_depotdownloader(exe: Path, appid: int, depot: int, out_dir: Path,
                        user: str, password: str, filelist: Path | None = None,
                        manifest: str | None = None, cwd: Path | None = None,
                        stdin=subprocess.DEVNULL) -> tuple[int, str]:
    """Run DepotDownloader once. Returns (returncode, combined_output).

    `manifest=None` downloads the current branch build. `cwd` is where DepotDownloader
    writes its remembered-session token/cache (kept on the data volume so the Steam
    Guard prompt only happens once). `stdin=None` inherits the terminal for `login`.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    run_cwd = Path(cwd) if cwd else config.SESSION_DIR
    run_cwd.mkdir(parents=True, exist_ok=True)

    cmd = [str(exe), "-app", str(appid), "-depot", str(depot)]
    if manifest:
        cmd += ["-manifest", str(manifest)]
    cmd += ["-username", user, "-password", password,
            "-dir", str(out_dir), "-remember-password",
            "-max-servers", str(config.MAX_SERVERS),
            "-max-downloads", str(config.MAX_DOWNLOADS)]
    if filelist is not None:
        cmd += ["-filelist", str(filelist)]

    printable = " ".join("***" if a == password else a for a in cmd)
    log(f"  $ {printable}")

    # Steer DepotDownloader's session/cache onto the persistent volume regardless
    # of whether it keys off cwd or $HOME.
    env = {**os.environ, "HOME": str(config.DATA_DIR)}

    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=stdin,
        text=True, bufsize=1, encoding="utf-8", errors="replace",
        cwd=str(run_cwd), env=env,
    )
    out_buf: list[str] = []
    err_buf: list[str] = []
    t_out = threading.Thread(target=_stream_reader,
                             args=(proc.stdout, sys.stdout, out_buf, _is_chunk_noise))
    t_err = threading.Thread(target=_stream_reader,
                             args=(proc.stderr, sys.stderr, err_buf))
    t_out.start()
    t_err.start()
    timed_out = False
    try:
        rc = proc.wait(timeout=config.DOWNLOAD_TIMEOUT or None)
    except subprocess.TimeoutExpired:
        timed_out = True
        log(f"  DepotDownloader still running after {config.DOWNLOAD_TIMEOUT}s; killing it.")
        proc.kill()
        rc = proc.wait()
    finally:
        # Never leave an orphaned DepotDownloader behind (e.g. on SIGTERM).
        if proc.poll() is None:
            proc.kill()
            proc.wait()
    t_out.join()
    t_err.join()
    output = "".join(out_buf) + "\n" + "".join(err_buf)
    if timed_out:
        output += "\n[watcher] download timed out"
    return rc, output


# --------------------------------------------------------------------------- #
# Filelist + archiving
# --------------------------------------------------------------------------- #

def build_filelist(names: list[str], dest: Path) -> Path:
    """Write a DepotDownloader -filelist matching each basename at the end of a
    path in ANY subdirectory (CS2 splits DLLs across game/bin/win64 and
    game/csgo/bin/win64)."""
    lines = ["# Generated by cs2-update -- one regex per line"]
    for raw in names:
        name = raw.strip().replace("\\", "/")
        if name:
            lines.append(r"regex:(?:^|.*[\\/])" + re.escape(name) + r"$")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    log(f"Filelist: {dest.name} ({len(lines) - 1} entr"
        f"{'y' if len(lines) - 1 == 1 else 'ies'})")
    return dest


def _flat_names(files: list[Path]) -> list[tuple[Path, str]]:
    """Pair each file with its archive name: flattened to the basename, with
    `_2`, `_3`... suffixes when two subdirectories hold the same basename."""
    used: set[str] = set()
    out = []
    for p in files:
        arcname = p.name
        if arcname in used:
            stem, suffix = os.path.splitext(p.name)
            n = 2
            while f"{stem}_{n}{suffix}" in used:
                n += 1
            arcname = f"{stem}_{n}{suffix}"
        used.add(arcname)
        out.append((p, arcname))
    return out


def archive_ext(compression: str) -> str:
    return ".7z" if compression == SEVENZIP else ".zip"


def part_path(dest: Path) -> Path:
    """Temp name for an archive being written. Dot-prefixed so nginx (which denies
    hidden files) never serves a half-written archive from /files/."""
    return dest.with_name(f".{dest.name}.part")


def sevenzip(src_dir: Path, dest: Path) -> None:
    """Solid LZMA2 max-compression .7z of every file directly inside src_dir.
    `nice` keeps it from starving the web services on this small box."""
    cmd = ["nice", "-n", "15", "7z", "a", "-t7z", "-mx=9",
           f"-mmt={config.SEVENZIP_THREADS}", "-bso0", "-bsp0", "-y",
           str(dest.resolve()), "--", "."]
    proc = subprocess.run(cmd, cwd=src_dir, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, text=True,
                          timeout=config.ARCHIVE_TIMEOUT or None)
    if proc.returncode != 0:
        raise RuntimeError(f"7z exited {proc.returncode}: {proc.stdout.strip()[-500:]}")


def archive_build(build_dir: Path, dest: Path, compression: str) -> int:
    """Archive every file under build_dir into dest (.7z or .zip), flattened to the
    archive root. Written to a hidden .part file then atomically renamed, so a crash
    never leaves a half-written archive behind. Returns the archive size in bytes."""
    files = [p for p in sorted(build_dir.rglob("*"))
             if p.is_file() and ".DepotDownloader" not in p.parts]
    named = _flat_names(files)

    tmp = part_path(dest)
    tmp.unlink(missing_ok=True)
    try:
        if compression == SEVENZIP:
            # 7z stores paths as given, so hard-link the files into one flat dir
            # (same filesystem, no copying) under their archive names.
            flat = build_dir / ".flat"
            shutil.rmtree(flat, ignore_errors=True)
            flat.mkdir()
            for p, arcname in named:
                os.link(p, flat / arcname)
            sevenzip(flat, tmp)
        else:
            comp, level = COMPRESSION.get(compression, COMPRESSION["deflate"])
            extra = {"compresslevel": level} if level is not None else {}
            with zipfile.ZipFile(tmp, "w", compression=comp, **extra) as zf:
                for p, arcname in named:
                    zf.write(p, arcname=arcname)
        os.chmod(tmp, 0o644)
        os.replace(tmp, dest)
    finally:
        tmp.unlink(missing_ok=True)
    return dest.stat().st_size
