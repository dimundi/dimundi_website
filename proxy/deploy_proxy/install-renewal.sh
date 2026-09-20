#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ "$PWD" == /home/docker/dimundi/proxy ]] || { echo 'Uruchom na VPS w /home/docker/dimundi/proxy.'; exit 1; }
[[ -f https.enabled ]] || { echo 'Najpierw wlacz HTTPS.'; exit 1; }
read -r -p 'Zapisac zadanie odnawiania w crontab biezacego uzytkownika? [t/n]: ' answer
[[ "${answer^^}" == T ]] || exit 0
command -v crontab >/dev/null || { echo 'Brak crontab. Z konta debian: sudo apt-get install cron'; exit 1; }
existing=$(mktemp)
trap 'rm -f "$existing"' EXIT
# An absent crontab is normal; other errors must not overwrite existing jobs.
if ! LC_ALL=C crontab -l >"$existing" 2>"$existing.err"; then
    if ! grep -qi 'no crontab for' "$existing.err"; then
        cat "$existing.err" >&2
        rm -f "$existing.err"
        exit 1
    fi
fi
rm -f "$existing.err"
if grep -q '# dimundi-cert-renew$' "$existing"; then
    echo 'Zadanie juz istnieje. Sprawdz crontab -l.'
    exit 0
fi
printf '\n17 3,15 * * * PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin /bin/bash /home/docker/dimundi/proxy/renew-cert.sh >> /home/docker/dimundi/proxy/renew-cert.log 2>&1 # dimundi-cert-renew\n' >>"$existing"
crontab "$existing"
echo 'Zapisano odnawianie o 03:17 i 15:17 czasu VPS. Log: renew-cert.log'
