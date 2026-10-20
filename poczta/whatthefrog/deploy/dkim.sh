#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_vps
confirm 'Przygotowac DKIM dla obu domen?' || exit 0
for domain in whathefrog.pl whatthefrog.pl; do
    selector="${domain%.pl}2026"
    key="/tmp/docker-mailserver/rspamd/dkim/rsa-2048-$selector-$domain"
    if ! dc exec -T mailserver test -s "$key.private.txt"; then
        dc exec -T mailserver setup config dkim domain "$domain" selector "$selector"
    fi
    echo "Rekord TXT: $selector._domainkey.$domain"
    dc exec -T mailserver cat "$key.public.dns.txt"
done

dc exec -T mailserver sh -c 'cat > /tmp/docker-mailserver/rspamd/override.d/dkim_signing.conf' < dkim-signing.conf
dc exec -T mailserver sh -c 'cp /tmp/docker-mailserver/rspamd/override.d/dkim_signing.conf /etc/rspamd/override.d/dkim_signing.conf && rspamadm configtest && supervisorctl signal HUP rspamd'
echo 'Opublikuj pokazany klucz publiczny w DNS. Zachowaj rekordy OVH na czas migracji.'
