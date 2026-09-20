#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /home/docker/dimundi/poczta/migration/marcin-20260920
[[ "$(id -un)" == docker ]] || { echo 'Uruchom jako docker.'; exit 1; }
exec 9>.migration.lock
flock -n 9 || { echo 'Migracja juz trwa.'; exit 1; }
[[ ! -f COMPLETE ]] || { echo 'Ta kopia zostala juz przeniesiona. Nie powtarzam.'; exit 0; }
printf '%s  Maildir.tar.gz\n' '3d1c686f970f4307d06aec3c436f3f8447c9e283534f790cd42b2b55f5c5e36c' | sha256sum -c -
dc() { docker compose -f /home/docker/dimundi/poczta/deploy/compose.yml "$@"; }
cid=$(dc ps -q mailserver)
[[ -n "$cid" ]]
[[ "$(docker inspect --format '{{.State.Health.Status}}' "$cid")" == healthy ]]
[[ "$(dc exec -T mailserver doveadm user -f mail_path marcin@dimundi.com)" == /var/mail/dimundi.com/marcin ]]
stage=/tmp/dimundi-migration-marcin-20260920
required=24000000000
if dc exec -T mailserver test -f "$stage/EXTRACTED"; then required=13000000000; fi
[[ $(df --output=avail -B1 /home/docker/dimundi | tail -n1) -gt "$required" ]] || { echo "Za malo miejsca: wymagane $required bajtow wolnych."; exit 1; }
dc exec -T mailserver mkdir -p "$stage"
docker cp verify-maildir.py "$cid:$stage/verify-maildir.py"
if ! dc exec -T mailserver test -f "$stage/EXTRACTED"; then
    dc exec -T mailserver test ! -d "$stage/Maildir" || { echo 'Niepelne rozpakowanie; sprawdz staging przed ponowieniem.'; exit 1; }
    echo 'Rozpakowywanie kopii Marcina (okolo 10 GB)...'
    dc exec -T mailserver tar -xzf - --no-same-owner -C "$stage" < Maildir.tar.gz
    dc exec -T mailserver chown -R 5000:5000 "$stage"
    dc exec -T mailserver touch "$stage/EXTRACTED"
fi
if [[ ! -f source.json ]]; then
    echo 'Obliczanie sum kontrolnych wiadomosci zrodlowych...'
    dc exec -T mailserver python3 "$stage/verify-maildir.py" snapshot "$stage/Maildir" > source.json.part
    mv source.json.part source.json
fi
if [[ ! -f target-before.json ]]; then
    dc exec -T mailserver python3 "$stage/verify-maildir.py" snapshot /var/mail/dimundi.com/marcin > target-before.json.part
    dc exec -T mailserver tar -czf - -C /var/mail/dimundi.com marcin > target-before.tar.gz.part
    mv target-before.tar.gz.part target-before.tar.gz
    mv target-before.json.part target-before.json
fi
docker cp source.json "$cid:$stage/source.json"
docker cp target-before.json "$cid:$stage/target-before.json"
dc exec -T mailserver python3 -c 'import json,sys; assert len(json.load(open(sys.argv[1]))) == 20751, "Nieoczekiwana liczba wiadomosci zrodla"' "$stage/source.json"
echo 'Zrodlo: zweryfikowana kopia Marcina (20751 wiadomosci, bez kosza).'
echo 'Cel: marcin@dimundi.com na nowym VPS. Bez zmiany starego serwera i DNS.'
read -r -p 'Rozpoczac jednokierunkowa synchronizacje Marcina? [t/n]: ' answer
[[ "${answer^^}" == T ]] || exit 0
touch STARTED
# Pull into the real mailbox; preserve destination-only mail. Never use backup -R here.
dc exec -T mailserver doveadm -v sync -1 -R -u marcin@dimundi.com "maildir:$stage/Maildir" 2>&1 | tee sync.log
echo 'Sprawdzanie zgodnosci wiadomosci i metadanych na nowym serwerze...'
dc exec -T mailserver python3 "$stage/verify-maildir.py" verify "$stage/source.json" "$stage/target-before.json" /var/mail/dimundi.com/marcin | tee verification.json
touch COMPLETE
echo 'GOTOWE. Porownano tresc wszystkich wiadomosci, foldery, daty i flagi. MX bez zmian.'
