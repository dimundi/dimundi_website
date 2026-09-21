#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_vps
mkdir -p ../data/config
for account in marcin@whatthefrog.pl biuro@whatthefrog.pl; do
    if [[ -f ../data/config/postfix-accounts.cf ]] && grep -qF "$account|" ../data/config/postfix-accounts.cf; then
        echo "Konto juz istnieje: $account"
        continue
    fi
    confirm "Utworzyc konto $account?" || exit 0
    dc run --rm --no-deps --entrypoint setup mailserver email add "$account"
done
target=../data/config/postfix-virtual.cf
if [[ -s "$target" ]] && ! cmp -s postfix-virtual.cf "$target"; then
    echo "Istniejace aliasy roznia sie od wzoru. Porownaj postfix-virtual.cf z $target i polacz recznie; nic nie nadpisano."
    exit 1
fi
confirm 'Ustawic przekierowanie biura i catch-all do Marcina?' || exit 0
cp postfix-virtual.cf "$target"
echo 'Konta i przekierowania gotowe. MX pozostaje bez zmian.'
