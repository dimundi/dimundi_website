#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_vps
echo 'Hasla sa wprowadzane w ukrytym monicie setup, bez argumentow i historii powloki.'
echo 'Istniejacych kont nie tworz ponownie; do zmiany hasla sluzy setup email update.'
for account in marcin@dimundi.com beata@dimundi.com; do
    if confirm "Utworzyc konto $account?"; then
        dc run --rm --no-deps --entrypoint setup mailserver email add "$account"
    fi
done
if confirm 'Dodac aliasy marcin@dimundi.pl i beata@dimundi.pl oraz postmaster/abuse do Marcina?'; then
    for person in marcin beata; do
        dc run --rm --no-deps --entrypoint setup mailserver alias add "$person@dimundi.pl" "$person@dimundi.com"
    done
    for domain in dimundi.com dimundi.pl; do
        for alias in postmaster abuse; do
            dc run --rm --no-deps --entrypoint setup mailserver alias add "$alias@$domain" marcin@dimundi.com
        done
    done
fi
