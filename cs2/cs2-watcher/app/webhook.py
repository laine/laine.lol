"""Webhook notifications for new-update events.

One `notify(event, ...)` entry point fans out to Discord (rich embed), Slack
(simple text), or a generic JSON POST, chosen by WEBHOOK_FORMAT (auto-detected
from the URL by default). A webhook failure is logged and swallowed -- it must
never break the watcher.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone

from . import config
from .depot import log

# Single embed colour for every event.
_EMBED_COLOR = 0xC77F81


def _detect_format(url: str) -> str:
    u = url.lower()
    if "discord.com/api/webhooks" in u or "discordapp.com/api/webhooks" in u:
        return "discord"
    if "hooks.slack.com" in u:
        return "slack"
    return "generic"


def _post(url: str, payload: dict) -> int:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json",
                 "User-Agent": "cs2-update-watcher"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status


def _build_payload(fmt: str, event: str, title: str, message: str,
                   fields: dict, url: str | None) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    if fmt == "discord":
        embed = {
            "title": title,
            "description": message,
            "color": _EMBED_COLOR,
            "timestamp": now,
            "fields": [{"name": str(k), "value": str(v), "inline": True}
                       for k, v in fields.items()],
        }
        if url:
            embed["url"] = url
        return {"embeds": [embed]}

    if fmt == "slack":
        lines = [f"*{title}*", message]
        lines += [f"• {k}: {v}" for k, v in fields.items()]
        if url:
            lines.append(f"<{url}|Download>")
        return {"text": "\n".join(lines)}

    # generic: a plain machine-readable JSON envelope
    return {
        "event": event,
        "title": title,
        "message": message,
        "fields": fields,
        "url": url,
        "app": config.APPID,
        "depot": config.DEPOT,
        "branch": config.BRANCH,
        "timestamp": now,
    }


def notify(event: str, *, title: str, message: str,
           fields: dict | None = None, url: str | None = None) -> None:
    """Send a notification for `event` if enabled. Never raises."""
    if not config.WEBHOOK_URL:
        return
    if config.WEBHOOK_EVENTS and event not in config.WEBHOOK_EVENTS:
        return

    fmt = config.WEBHOOK_FORMAT
    if fmt not in ("discord", "slack", "generic"):
        fmt = _detect_format(config.WEBHOOK_URL)

    try:
        payload = _build_payload(fmt, event, title, message, fields or {}, url)
        _post(config.WEBHOOK_URL, payload)
        log(f"webhook: sent '{event}' ({fmt})")
    except Exception as e:  # noqa: BLE001 -- a webhook must never break the loop
        log(f"webhook: failed to send '{event}': {e}")
