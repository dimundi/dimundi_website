#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_vps
[[ -f "$PROXY_DIR/mail-conf/https.enabled" ]] || {
    echo 'Najpierw wykonaj setup-tls.sh.'; exit 1;
}
confirm 'Zastosowac limit WWW i wyjatek Fail2Ban dla Roundcube? Kontenery poczty zostana odtworzone.' || exit 0
dc config --quiet
target="$PROXY_DIR/mail-conf/poczta.conf"
backup=$(mktemp)
trap 'rm -f "$backup"' EXIT
cp "$target" "$backup"
cp nginx-https.conf "$target"
if ! proxy exec -T proxy nginx -t || ! proxy exec -T proxy nginx -s reload; then
    cp "$backup" "$target"
    echo 'Nie wlaczono poprawki Fail2Ban. Przywrocono plik proxy.'
    exit 1
fi
# The HTTP limit must be active before exempting Roundcube from bans.
dc up -d --no-build --wait --wait-timeout 300
# A pre-existing ban is not removed just by changing ignorecommand.
ips=$(dc exec -T mailserver getent ahostsv4 dimundi-roundcube | awk '{print $1}' | sort -u)
[[ -n "$ips" ]] || { echo 'Nie mozna ustalic IP Roundcube.'; exit 1; }
for ip in $ips; do
    dc exec -T mailserver bash /usr/local/bin/ignore-roundcube.sh "$ip"
    dc exec -T mailserver fail2ban-client unban "$ip"
done
dc exec -T mailserver fail2ban-client get dovecot ignorecommand
echo 'Gotowe. Zaloguj sie pelnym adresem skrzynki. HTTP 429 oznacza przekroczenie limitu prob z danego IP.'
