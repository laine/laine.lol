"""CLI dispatcher: `python -m app [watch|once|login|backfill]` (default: watch)."""

from __future__ import annotations

import sys

from .depot import die

USAGE = "Usage: python -m app [watch|once|login|backfill]"


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    cmd = (argv[0] if argv else "watch").lower()

    if cmd in ("watch", "run", ""):
        from .watcher import watch
        return watch()
    if cmd == "once":
        from .watcher import run_once
        return run_once()
    if cmd == "backfill":
        from .backfill import backfill
        return backfill()
    if cmd == "login":
        from .login import login
        return login()
    if cmd in ("-h", "--help", "help"):
        print(USAGE)
        return 0

    print(f"Unknown command: {cmd!r}\n{USAGE}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        die("Interrupted.", code=130)
