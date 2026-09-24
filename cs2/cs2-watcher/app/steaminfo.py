"""Login-free build detection via the steamcmd.net app-info mirror.

This is the key difference from the original "download every manifest" tool: we
detect *whether* a new build exists without signing in to Steam at all (so the
frequent poll can't trip Steam's login rate limit). A Steam login only happens
when a change is detected and we actually download it.

The API returns Steam's PICS app info as JSON. We read, for the watched depot and
branch, the current manifest GID plus the branch's build id and last-updated time:

    GET https://api.steamcmd.net/v1/info/730
    data["730"]["depots"]["2347771"]["manifests"]["public"]["gid"]
    data["730"]["depots"]["branches"]["public"]["buildid" | "timeupdated"]
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from . import config


class BuildInfo:
    """Current build of one (app, depot, branch)."""

    __slots__ = ("manifest", "buildid", "timeupdated")

    def __init__(self, manifest: str | None, buildid: str | None,
                 timeupdated: int | None):
        self.manifest = manifest
        self.buildid = buildid
        self.timeupdated = timeupdated

    @property
    def key(self) -> str | None:
        """The value used to decide 'has this changed?' -- manifest if available,
        else the build id (some apps don't expose a per-depot manifest GID)."""
        return self.manifest or self.buildid

    def as_dict(self) -> dict:
        return {"manifest": self.manifest, "buildid": self.buildid,
                "timeupdated": self.timeupdated}

    @classmethod
    def from_dict(cls, d: dict | None) -> "BuildInfo | None":
        if not d:
            return None
        return cls(d.get("manifest"), d.get("buildid"), d.get("timeupdated"))


def fetch_build_info(appid: int, depot: int, branch: str) -> BuildInfo:
    """Fetch the current build for (appid, depot, branch). Raises on network or
    parse error so the caller can log it and keep polling."""
    url = f"{config.STEAMCMD_API}/{appid}"
    req = urllib.request.Request(url, headers={"User-Agent": "cs2-update-watcher"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.loads(resp.read())

    if payload.get("status") != "success":
        raise RuntimeError(f"steamcmd API status={payload.get('status')!r}")

    app = (payload.get("data") or {}).get(str(appid)) or {}
    depots = app.get("depots") or {}

    dinfo = depots.get(str(depot)) or {}
    manifests = (dinfo.get("manifests") or {}).get(branch) or {}
    manifest = manifests.get("gid")

    binfo = (depots.get("branches") or {}).get(branch) or {}
    buildid = binfo.get("buildid")

    timeupdated = binfo.get("timeupdated")
    try:
        timeupdated = int(timeupdated) if timeupdated is not None else None
    except (TypeError, ValueError):
        timeupdated = None

    return BuildInfo(manifest=manifest, buildid=buildid, timeupdated=timeupdated)
