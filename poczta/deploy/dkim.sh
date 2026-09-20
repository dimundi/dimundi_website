#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_vps
confirm 'Przygotowac klucze DKIM i konfiguracje podpisywania dla dimundi.com i dimundi.pl?' || exit 0
for domain in dimundi.com dimundi.pl; do
    key="/tmp/docker-mailserver/rspamd/dkim/rsa-2048-dimundi2026-$domain"
    if ! dc exec -T mailserver test -s "$key.private.txt"; then
        dc exec -T mailserver setup config dkim domain "$domain" selector dimundi2026
    fi
    echo "Rekord TXT: dimundi2026._domainkey.$domain"
    dc exec -T mailserver cat "$key.public.dns.txt"
done
dc exec -T mailserver sh -c 'cat > /tmp/docker-mailserver/rspamd/override.d/dkim_signing.conf' < dkim-signing.conf
dc exec -T mailserver sh -c 'cp /tmp/docker-mailserver/rspamd/override.d/dkim_signing.conf /etc/rspamd/override.d/dkim_signing.conf && rspamadm configtest && supervisorctl signal HUP rspamd'
echo 'Klucze gotowe. Publikacja rekordow DNS jest osobnym krokiem; stary selektor mail pozostaje bez zmian.'
