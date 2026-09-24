# cs2-update watcher image.
#
# Pure-stdlib Python app + the self-contained DepotDownloader release (downloaded
# on first run into the /data volume, so no .NET install is baked in). .NET runs
# in invariant-globalization mode, which removes the libicu dependency entirely.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    DATA_DIR=/data

# ca-certificates: TLS to Steam/GitHub. 7zip: builds are archived as solid .7z.
# Everything else .NET needs is bundled in the self-contained DepotDownloader build.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates 7zip \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY app/ ./app/

RUN mkdir -p /data
VOLUME ["/data"]

# Default command is the watch loop; override with `login` / `once` / `backfill`.
ENTRYPOINT ["python", "-m", "app"]
CMD ["watch"]
