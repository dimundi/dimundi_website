#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_vps
exec 9>"$PROXY_DIR/.certbot.lock"
flock -n 9 || { echo 'Certbot jest zajety; ponow pozniej.'; exit 1; }
proxy exec -T proxy test -d /etc/nginx/mail-conf || {
    echo 'Brak montowania mail-conf w proxy.'; exit 1;
}
# Keep existing old-domain HTTPS available while validating the new names.
target="$PROXY_DIR/mail-conf/whatthefrog.conf"
bootstrap="$PROXY_DIR/mail-conf/whathefrog-acme.conf"
confirm 'Wlaczyc HTTP-01 nowej domeny bez zmiany istniejacego HTTPS?' || exit 0
if [[ -s "$target" ]]; then
    sed 's/ poczta.whatthefrog.pl webmail.whatthefrog.pl//' nginx-http.conf > "$bootstrap"
else
    cp nginx-http.conf "$bootstrap"
fi
if ! proxy exec -T proxy nginx -t; then
    rm -f "$bootstrap"
    exit 1
fi
proxy exec -T proxy nginx -s reload
read -r -p 'E-mail konta Lets Encrypt: ' email
[[ "$email" == *@*.* && "$email" != *' '* ]] || { echo 'Niepoprawny e-mail.'; exit 1; }
echo 'Warunki Lets Encrypt: https://letsencrypt.org/repository/'
confirm 'Zaakceptowac warunki i przetestowac weryfikacje czterech nazw (dry-run)?' || exit 0
args=(certonly --webroot -w /var/www/certbot --cert-name poczta.whathefrog.pl
    -d poczta.whathefrog.pl -d webmail.whathefrog.pl
    -d poczta.whatthefrog.pl -d webmail.whatthefrog.pl
    --email "$email" --agree-tos --non-interactive)
proxy run --rm --no-deps certbot "${args[@]}" --dry-run
confirm 'Wystawic produkcyjny certyfikat dla obu domen?' || exit 0
proxy run --rm --no-deps certbot "${args[@]}"
confirm 'Wlaczyc jeden webmail pod oboma adresami HTTPS?' || exit 0
backup=$(mktemp)
had_config=0
if [[ -f "$target" ]]; then cp "$target" "$backup"; had_config=1; fi
cp nginx-https.conf "$target"
rm -f "$bootstrap"
if ! proxy exec -T proxy nginx -t; then
    if [[ "$had_config" == 1 ]]; then cp "$backup" "$target"; else rm -f "$target"; fi
    rm -f "$backup"
    echo 'Blad walidacji; przywrocono poprzedni plik.'
    exit 1
fi
if ! proxy exec -T proxy nginx -s reload; then
    if [[ "$had_config" == 1 ]]; then cp "$backup" "$target"; else rm -f "$target"; fi
    rm -f "$backup"
    echo 'Blad reload; przywrocono poprzedni plik. Sprawdz stan proxy.'
    exit 1
fi
rm -f "$backup"
touch "$PROXY_DIR/mail-conf/whatthefrog-https.enabled"
echo 'TLS gotowy. Sprawdz odnawianie: bash /home/docker/dimundi/proxy/renew-cert.sh --dry-run.'
