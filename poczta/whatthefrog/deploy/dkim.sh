#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_vps
confirm 'Przygotowac DKIM dla whatthefrog.pl?' || exit 0
key=/tmp/docker-mailserver/rspamd/dkim/rsa-2048-whatthefrog2026-whatthefrog.pl
if ! dc exec -T mailserver test -s "$key.private.txt"; then
    dc exec -T mailserver setup config dkim domain whatthefrog.pl selector whatthefrog2026
fi
echo 'Rekord TXT: whatthefrog2026._domainkey.whatthefrog.pl'
dc exec -T mailserver cat "$key.public.dns.txt"
dc exec -T mailserver sh -c 'cat > /tmp/docker-mailserver/rspamd/override.d/dkim_signing.conf' < dkim-signing.conf
dc exec -T mailserver sh -c 'cp /tmp/docker-mailserver/rspamd/override.d/dkim_signing.conf /etc/rspamd/override.d/dkim_signing.conf && rspamadm configtest && supervisorctl signal HUP rspamd'
echo 'Opublikuj pokazany klucz publiczny w DNS. Zachowaj rekordy OVH na czas migracji.'
