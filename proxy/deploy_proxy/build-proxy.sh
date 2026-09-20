#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

read -r -p 'Zbudowac obraz proxy na tym serwerze? [t/n]: ' answer
if [[ "${answer^^}" != T ]]; then
    echo 'Anulowano budowanie.'
    exit 0
fi

mkdir -p mail-conf
docker compose -f compose.yml config --quiet
docker compose -f compose.yml build --pull
docker compose -f compose.yml run --rm --no-deps proxy nginx -t

read -r -p 'Uruchomic/odtworzyc kontener proxy na porcie 80? [t/n]: ' answer
if [[ "${answer^^}" != T ]]; then
    echo 'Obraz gotowy. Kontener nie zostal uruchomiony ani odtworzony.'
    exit 0
fi

docker compose -f compose.yml up -d --no-build --force-recreate proxy
docker compose -f compose.yml ps
