"""cs2-update: detect new Steam builds and archive only the new ones.

Combines a login-free build detector (steamcmd.net) with the DepotDownloader
download/zip pipeline and webhook notifications. Designed to run as a long-lived
Docker container that polls for new builds and downloads each one exactly once.
"""

__version__ = "1.0.0"
