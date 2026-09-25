# cs2-update watcher image.
#
# Pure-stdlib Python app + a pinned, checksum-verified DepotDownloader release
# (self-contained, so no .NET install). .NET runs in invariant-globalization mode,
# which removes the libicu dependency entirely.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    DATA_DIR=/data

# ca-certificates: TLS to Steam. 7zip: builds are archived as solid .7z (and it
# unpacks the DepotDownloader release below).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates 7zip \
 && rm -rf /var/lib/apt/lists/*

# DepotDownloader runs with the Steam session token, so pin the exact release and
# verify its sha256 instead of fetching "latest" at runtime. It's found on PATH
# before the app's auto-download fallback. To upgrade: bump both ARGs.
ARG DEPOTDOWNLOADER_VERSION=3.4.0
ARG DEPOTDOWNLOADER_SHA256=a999dec66b4850fc961bd50366696d23c2d0fad7b18790e6a5647b2f19097a53
RUN python -c "import urllib.request; urllib.request.urlretrieve('https://github.com/SteamRE/DepotDownloader/releases/download/DepotDownloader_${DEPOTDOWNLOADER_VERSION}/DepotDownloader-linux-x64.zip', '/tmp/dd.zip')" \
 && echo "${DEPOTDOWNLOADER_SHA256}  /tmp/dd.zip" | sha256sum -c - \
 && 7z x -bso0 -bsp0 -o/opt/depotdownloader /tmp/dd.zip \
 && chmod 755 /opt/depotdownloader/DepotDownloader \
 && rm /tmp/dd.zip
ENV PATH="/opt/depotdownloader:${PATH}"

WORKDIR /app
COPY app/ ./app/

# Run unprivileged. The cs2-data volume must be owned by this uid (a volume
# created by an older root image needs a one-time chown, see README).
RUN useradd --uid 10001 --home-dir /data --no-create-home --shell /usr/sbin/nologin watcher \
 && mkdir -p /data && chown watcher:watcher /data
USER 10001
VOLUME ["/data"]

# Default command is the watch loop; override with `login` / `once` / `backfill`.
ENTRYPOINT ["python", "-m", "app"]
CMD ["watch"]
