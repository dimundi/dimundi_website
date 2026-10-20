#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_vps
mkdir -p ../data/config
for account in marcin@whathefrog.pl biuro@whathefrog.pl; do
    if [[ -f ../data/config/postfix-accounts.cf ]] && grep -qF "$account|" ../data/config/postfix-accounts.cf; then
        echo "Konto juz istnieje: $account"
        continue
    fi
    confirm "Utworzyc konto $account?" || exit 0
    dc run --rm --no-deps --entrypoint setup mailserver email add "$account"
done
echo 'Konto gotowe. Stare konta i aliasy pozostawiono bez zmian.'
echo 'Wzor postfix-virtual.cf zawiera routing docelowy obu domen.'
echo 'Zastosuj aliasy osobno po kopii i porownaniu konfiguracji, na uzgodnionym etapie migracji.'
echo 'Nie usuwaj starych kont przed weryfikacja migracji. MX pozostaje bez zmian.'
