#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_vps
confirm 'Przygotowac katalogi i pobrac obrazy poczty oraz Roundcube?' || exit 0
docker network inspect dimundi-proxy_default >/dev/null
mkdir -p ../data/config ../secrets
chmod 700 ../secrets
if [[ ! -s ../secrets/roundcube_des_key ]]; then
    (umask 077; openssl rand -hex 12 | tr -d '\n' > ../secrets/roundcube_des_key)
fi
# The parent directory is 0700 on the host; Apache must read the mounted file.
chmod 644 ../secrets/roundcube_des_key
dc config --quiet
dc pull
echo 'Obrazy gotowe. Certyfikat: bash setup-tls.sh; konta: bash accounts.sh.'
confirm 'Uruchomic/odtworzyc kontenery? Wymaga gotowego certyfikatu i przynajmniej jednego konta.' || exit 0
dc run --rm --no-deps --entrypoint bash mailserver -c 'test -s /tmp/docker-mailserver/postfix-accounts.cf && test -s /etc/letsencrypt/live/poczta.dimundi.com/fullchain.pem && test -s /etc/letsencrypt/live/poczta.dimundi.com/privkey.pem' || {
    echo 'Brak kont lub certyfikatu. Wykonaj accounts.sh i setup-tls.sh.'; exit 1;
}
dc up -d --no-build --wait --wait-timeout 300
dc ps
echo 'Kontenery uruchomione. Nie zmieniaj jeszcze MX; migracja i testy sa osobnym etapem.'
