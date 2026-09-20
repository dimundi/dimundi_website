#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /home/docker/dimundi/poczta/migration/beata-20260920
[[ "$(id -un)" == docker ]] || { echo 'Uruchom jako docker.'; exit 1; }
exec 9>.migration.lock
flock -n 9 || { echo 'Migracja juz trwa.'; exit 1; }
[[ ! -f COMPLETE ]] || { echo 'Ta kopia zostala juz przeniesiona. Nie powtarzam.'; exit 0; }
printf '%s  Maildir.tar.gz\n' '5c0b8719262eff47e6174e03fb8bf50ff029f792856fb2bcaadd6b56491cfda2' | sha256sum -c -
dc() { docker compose -f /home/docker/dimundi/poczta/deploy/compose.yml "$@"; }
cid=$(dc ps -q mailserver)
[[ -n "$cid" ]]
[[ "$(docker inspect --format '{{.State.Health.Status}}' "$cid")" == healthy ]]
[[ "$(dc exec -T mailserver doveadm user -f mail_path beata@dimundi.com)" == /var/mail/dimundi.com/beata ]]
[[ $(df --output=avail -B1 /home/docker/dimundi | tail -n1) -gt 6000000000 ]] || { echo 'Wymagane 6 GB wolnego.'; exit 1; }
stage=/tmp/dimundi-migration-beata-20260920
dc exec -T mailserver mkdir -p "$stage"
docker cp verify-maildir.py "$cid:$stage/verify-maildir.py"
if ! dc exec -T mailserver test -f "$stage/EXTRACTED"; then
    dc exec -T mailserver test ! -d "$stage/Maildir" || { echo 'Niepelne rozpakowanie; sprawdz staging przed ponowieniem.'; exit 1; }
    dc exec -T mailserver tar -xzf - --no-same-owner -C "$stage" < Maildir.tar.gz
    dc exec -T mailserver chown -R 5000:5000 "$stage"
    dc exec -T mailserver touch "$stage/EXTRACTED"
fi
if [[ ! -f source.json ]]; then
    dc exec -T mailserver python3 "$stage/verify-maildir.py" snapshot "$stage/Maildir" > source.json
fi
if [[ ! -f target-before.json ]]; then
    dc exec -T mailserver python3 "$stage/verify-maildir.py" snapshot /var/mail/dimundi.com/beata > target-before.json
    dc exec -T mailserver tar -czf - -C /var/mail/dimundi.com beata > target-before.tar.gz
fi
docker cp source.json "$cid:$stage/source.json"
docker cp target-before.json "$cid:$stage/target-before.json"
dc exec -T mailserver python3 -c 'import json,sys; assert len(json.load(open(sys.argv[1]))) == 3463, "Nieoczekiwana liczba wiadomosci zrodla"' "$stage/source.json"
echo 'Zrodlo: zweryfikowana kopia Beaty (3463 wiadomosci, bez kosza).'
echo 'Cel: beata@dimundi.com na nowym VPS. Bez zmiany starego serwera i DNS.'
read -r -p 'Rozpoczac jednokierunkowa synchronizacje Beaty? [t/n]: ' answer
[[ "${answer^^}" == T ]] || exit 0
touch STARTED
# Pull into the real mailbox; preserve destination-only mail. Never use backup -R here.
dc exec -T mailserver doveadm -v sync -1 -R -u beata@dimundi.com "maildir:$stage/Maildir" 2>&1 | tee sync.log
dc exec -T mailserver python3 "$stage/verify-maildir.py" verify "$stage/source.json" "$stage/target-before.json" /var/mail/dimundi.com/beata | tee verification.json
touch COMPLETE
echo 'GOTOWE. Porownano tresc wszystkich wiadomosci, foldery, daty i flagi. MX bez zmian.'
