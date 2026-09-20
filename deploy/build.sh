#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if [[ ! -f ../backend/.env ]]; then
    echo 'Brak backend/.env. Wyslij go przez install.bat lub utworz z backend/.env_tmpl.'
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
docker compose -f compose.yml exec -T frontend wget -q -O /dev/null http://localhost/
docker compose -f compose.yml ps
echo 'Strona uruchomiona. Przy pierwszym wdrozeniu wyslij i przeladuj konfiguracje proxy przez install-proxy.bat.'
