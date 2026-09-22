#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if [[ ! -f ../backend/.env ]]; then
    echo 'Brak prywatnego backend/.env. Utworz i uzupelnij go na VPS zgodnie z deploy.md; install.bat nie wysyla tego pliku.'
    exit 1
fi
if [[ ! -f backend.env ]]; then
    echo 'Brak deploy/backend.env. Wyslij pliki przez aktualny install.bat.'
    exit 1
fi
read -r -p 'Zbudowac obrazy strony na tym serwerze? [t/n]: ' answer
if [[ "${answer^^}" != T ]]; then exit 0; fi
if ! docker network inspect dimundi-proxy_default >/dev/null 2>&1; then
    echo 'Brak sieci proxy. Najpierw uruchom proxy przez build-proxy.sh.'
    exit 1
fi
docker compose -f compose.yml config --quiet
docker compose -f compose.yml build --pull
docker compose -f compose.yml run --rm --no-deps frontend nginx -t

read -r -p 'Uruchomic/odtworzyc kontenery strony? [t/n]: ' answer
if [[ "${answer^^}" != T ]]; then exit 0; fi
docker compose -f compose.yml up -d --no-build --force-recreate --wait
# Nginx listens on IPv4; BusyBox wget resolves localhost to ::1 first.
docker compose -f compose.yml exec -T frontend wget -q -O /dev/null http://127.0.0.1/
docker compose -f compose.yml ps
echo 'Strona uruchomiona. Przy pierwszym wdrozeniu wyslij i przeladuj konfiguracje proxy przez install-proxy.bat.'
