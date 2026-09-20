#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ "$(id -un)" == docker ]]
cd /home/docker/dimundi/poczta/deploy
docker compose ps
docker compose exec -T mailserver doveadm user marcin@dimundi.com </dev/null
docker compose exec -T mailserver doveadm mailbox status -u marcin@dimundi.com 'messages vsize' '*' </dev/null
df -h /home/docker/dimundi
free=$(df --output=avail -B1 /home/docker/dimundi | tail -n1)
# Archive 6.78 GB + two copies of ~10.03 GB + metadata and reserve.
[[ "$free" -gt 31000000000 ]] || {
    echo 'Za malo miejsca na bezpieczna pierwsza migracje. Potrzeba 31 GB wolnego przed wysylka.'
    echo 'Przerwano bez przesylania archiwum i bez zmian w skrzynkach.'
    exit 1
}
mkdir -p /home/docker/dimundi/poczta/migration/marcin-20260920
