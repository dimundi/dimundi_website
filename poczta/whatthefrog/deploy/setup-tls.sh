#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_vps
exec 9>"$PROXY_DIR/.certbot.lock"
flock -n 9 || { echo 'Certbot jest zajety; ponow pozniej.'; exit 1; }
proxy exec -T proxy test -d /etc/nginx/mail-conf || {
    echo 'Najpierw wyslij nowe pliki proxy i uruchom build-proxy.sh (nowe montowanie mail-conf).'; exit 1;
}
apply_config() {
    local source=$1 target="$PROXY_DIR/mail-conf/whatthefrog.conf" backup
    backup=$(mktemp)
    local had_config=0
    if [[ -f "$target" ]]; then cp "$target" "$backup"; had_config=1; fi
    cp "$source" "$target"
    if ! proxy exec -T proxy nginx -t || ! proxy exec -T proxy nginx -s reload; then
        if [[ "$had_config" == 1 ]]; then cp "$backup" "$target"; else rm -f "$target"; fi
        rm -f "$backup"
        echo 'Nie zastosowano konfiguracji. Przywrocono poprzedni plik.'
        return 1
    fi
    rm -f "$backup"
}
if [[ ! -f "$PROXY_DIR/mail-conf/whatthefrog-https.enabled" ]]; then
    confirm 'Wlaczyc obsluge HTTP-01 dla poczta.whatthefrog.pl i webmail.whatthefrog.pl?' || exit 0
    apply_config nginx-http.conf
fi
read -r -p 'E-mail konta Lets Encrypt: ' email
[[ "$email" == *@*.* && "$email" != *' '* ]] || { echo 'Niepoprawny e-mail.'; exit 1; }
echo 'Warunki Lets Encrypt: https://letsencrypt.org/repository/'
confirm 'Zaakceptowac warunki i przetestowac weryfikacje domen (dry-run)?' || exit 0
args=(certonly --webroot -w /var/www/certbot --cert-name poczta.whatthefrog.pl
    -d poczta.whatthefrog.pl -d webmail.whatthefrog.pl --email "$email" --agree-tos --non-interactive)
proxy run --rm --no-deps certbot "${args[@]}" --dry-run
confirm 'Wystawic produkcyjny certyfikat poczty i webmaila?' || exit 0
proxy run --rm --no-deps certbot "${args[@]}"
confirm 'Wlaczyc HTTPS webmaila? Do startu Roundcube moze odpowiadac 502.' || exit 0
apply_config nginx-https.conf
touch "$PROXY_DIR/mail-conf/whatthefrog-https.enabled"
echo 'Certyfikat gotowy. Zaktualizowany renew-cert.sh proxy odnawia wszystkie certyfikaty.'
echo 'Sprawdz crontab -l oraz bash /home/docker/dimundi/proxy/renew-cert.sh --dry-run.'
