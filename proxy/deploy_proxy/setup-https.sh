#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
confirm() {
    local answer
    read -r -p "$1 [t/n]: " answer
    [[ "${answer^^}" == T ]]
}
exec 9>.certbot.lock
flock -n 9 || { echo 'Inna operacja certyfikatu jest w toku.'; exit 1; }

echo 'Wszystkie cztery domeny musza wskazywac na ten VPS (A oraz AAAA, jesli istnieje).'
echo 'Porty 80 i 443 musza byc dostepne z Internetu.'
confirm 'Przygotowac katalogi i odtworzyc proxy z portem 443 i montowaniami ACME?' || exit 0
mkdir -p acme
docker compose -f compose.yml config --quiet
docker compose -f compose.yml run --rm --no-deps proxy nginx -t
docker compose -f compose.yml up -d --no-build --force-recreate proxy

read -r -p 'Adres e-mail konta Lets Encrypt: ' email
[[ "$email" == *@*.* && "$email" != *' '* ]] || { echo 'Niepoprawny e-mail.'; exit 1; }
echo 'Certbot zarejestruje konto z tym adresem i zaakceptuje warunki Lets Encrypt:'
echo 'https://letsencrypt.org/repository/'
confirm 'Zaakceptowac warunki i wykonac probe weryfikacji czterech domen (dry-run)?' || exit 0
certbot_args=(certonly --webroot -w /var/www/certbot --cert-name dimundi.com
    -d dimundi.com -d www.dimundi.com -d dimundi.pl -d www.dimundi.pl
    --email "$email" --agree-tos --non-interactive)
docker compose -f compose.yml run --rm --no-deps certbot "${certbot_args[@]}" --dry-run
confirm 'Wystawic produkcyjny certyfikat dla czterech domen?' || exit 0
docker compose -f compose.yml run --rm --no-deps certbot "${certbot_args[@]}"

confirm 'Wlaczyc HTTPS i przekierowania na https://dimundi.com?' || exit 0
cp -p nginx.conf nginx.conf.before-https
# Keep the bind-mounted file inode unchanged.
cat nginx-https.conf > nginx.conf
if ! docker compose -f compose.yml exec -T proxy nginx -t; then
    cat nginx.conf.before-https > nginx.conf
    echo 'Blad konfiguracji HTTPS. Przywrocono poprzedni plik.'
    exit 1
fi
if ! docker compose -f compose.yml exec -T proxy nginx -s reload; then
    cat nginx.conf.before-https > nginx.conf
    echo 'Reload nie powiodl sie; przywrocono plik. Sprawdz stan proxy.'
    exit 1
fi
touch https.enabled
echo 'HTTPS wlaczone.'

if ! command -v crontab >/dev/null; then
    echo 'Brak crontab. Zainstaluj cron z konta z sudo, potem uruchom bash install-renewal.sh.'
    exit 1
fi
bash install-renewal.sh
