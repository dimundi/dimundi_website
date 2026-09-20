#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
exec 9>.certbot.lock
flock -n 9 || exit 0
[[ -f https.enabled ]] || { echo 'HTTPS nie jest jeszcze wlaczone.'; exit 1; }
# Exit 0 also means no renewal was necessary. Reload is safe in either case.
renew_status=0
docker compose -f compose.yml run --rm --no-deps certbot renew --non-interactive "$@" || renew_status=$?
docker compose -f compose.yml exec -T proxy nginx -t
docker compose -f compose.yml exec -T proxy nginx -s reload
# Some certificates may renew even if another failed. Still report that failure.
exit "$renew_status"
