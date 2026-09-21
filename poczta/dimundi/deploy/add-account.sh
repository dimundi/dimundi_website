#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_vps

# Inspect only account names; never print password hashes.
check_available() {
    dc exec -T mailserver python3 - "$1" <<'PY'
import pathlib, sys
address = sys.argv[1].lower()
root = pathlib.Path('/tmp/docker-mailserver')
for filename, separator in [('postfix-accounts.cf', '|'), ('postfix-virtual.cf', None)]:
    path = root / filename
    if not path.exists():
        continue
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.split(separator, 1)[0].strip().lower() == address:
            print('Adres juz istnieje jako konto lub alias: ' + address, file=sys.stderr)
            sys.exit(1)
PY
}

read -r -p 'Nowa skrzynka (np. anna lub anna@dimundi.com): ' account
account=${account,,}
[[ "$account" == *@* ]] || account="$account@dimundi.com"
localpart=${account%@*}
[[ "$account" == "$localpart@dimundi.com" &&
   "$localpart" =~ ^[a-z0-9][a-z0-9._+-]*$ &&
   ${#localpart} -le 64 && "$localpart" != *..* && "$localpart" != *. ]] || {
    echo 'Podaj poprawna nazwe skrzynki w dimundi.com. Domena .pl sluzy jako alias.'
    exit 1
}
check_available "$account"
alias_address="$localpart@dimundi.pl"
add_alias=false
if confirm "Dodac rowniez alias $alias_address do tej skrzynki?"; then
    check_available "$alias_address"
    add_alias=true
fi
confirm "Utworzyc konto $account?" || exit 0
echo 'Wpisz haslo w ukrytym monicie. Nie podajemy go jako argumentu polecenia.'
dc exec mailserver setup email add "$account"
echo "Utworzono konto: $account"
# A catch-all takes precedence over mailbox lookup. Preserve local delivery
# for the new account with an explicit self-mapping (setup alias rejects it).
if ! dc exec -T mailserver python3 - "$account" <<'PY'
import pathlib, sys
account = sys.argv[1]
path = pathlib.Path('/tmp/docker-mailserver/postfix-virtual.cf')
text = path.read_text() if path.exists() else ''
keys = {line.split()[0].lower() for line in text.splitlines()
        if line.strip() and not line.lstrip().startswith('#')}
if '@' + account.split('@', 1)[1] in keys and account not in keys:
    path.write_text(account + ' ' + account + '\n' + text)
PY
then
    echo "Konto istnieje, ale nie dodano wyjatku catch-all. Przed uzyciem dodaj w postfix-virtual.cf: $account $account"
    exit 1
fi
if [[ "$add_alias" == true ]]; then
    if ! dc exec mailserver setup alias add "$alias_address" "$account"; then
        echo "Konto $account istnieje, ale alias nie zostal dodany. Nie tworz konta ponownie."
        exit 1
    fi
    echo "Alias: $alias_address -> $account"
fi
echo 'Gotowe. Login: pelny adres .com. Serwer: poczta.dimundi.com; IMAP 993 SSL/TLS, SMTP 587 STARTTLS.'
