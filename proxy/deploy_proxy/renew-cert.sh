#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
exec 9>.certbot.lock
flock -n 9 || exit 0
[[ -f https.enabled ]] || { echo 'HTTPS nie jest jeszcze wlaczone.'; exit 1; }
# Exit 0 also means no renewal was necessary. Reload is safe in either case.
docker compose -f compose.yml run --rm --no-deps certbot renew --cert-name dimundi.com --non-interactive "$@"
docker compose -f compose.yml exec -T proxy nginx -t
docker compose -f compose.yml exec -T proxy nginx -s reload
