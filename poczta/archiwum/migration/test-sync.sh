#!/usr/bin/env bash
set -euo pipefail
# Isolated disposable Docker container only. Synthetic messages, no real mail.
mkdir -p /tmp/source/{cur,new,tmp} /tmp/source/.Sent/{cur,new,tmp} /tmp/target/{cur,new,tmp}
cat >/tmp/dovecot-test.conf <<'EOF'
dovecot_config_version = 2.4.1
dovecot_storage_version = 2.4.1
mail_driver = maildir
mail_path = /tmp/target
mail_uid = 5000
mail_gid = 5000
mail_home = /tmp/test-user
log_path = /dev/stderr
EOF
printf 'From: test@example.invalid\nMessage-ID: <source@example.invalid>\nDate: Sun, 20 Sep 2026 12:00:00 +0200\nSubject: Test\n\nsource\n' >/tmp/source/cur/100.test:2,S
printf 'From: test@example.invalid\nMessage-ID: <sent@example.invalid>\nDate: Sun, 20 Sep 2026 12:01:00 +0200\nSubject: Test\n\nsent\n' >/tmp/source/.Sent/cur/101.test:2,RS
printf 'From: test@example.invalid\nMessage-ID: <target@example.invalid>\nDate: Sun, 20 Sep 2026 12:02:00 +0200\nSubject: Test\n\ntarget\n' >/tmp/target/cur/102.test:2,S
touch -d '2021-02-03 04:05:06 UTC' /tmp/source/cur/100.test:2,S
printf 'Sent\n' >/tmp/source/subscriptions
chown -R 5000:5000 /tmp/source /tmp/target
export USER=test
python3 /test/verify-maildir.py snapshot /tmp/source >/tmp/source.json
python3 /test/verify-maildir.py snapshot /tmp/target >/tmp/before.json
for attempt in 1 2; do
  doveadm -c /tmp/dovecot-test.conf sync --no-userdb-lookup -1 -R 'maildir:/tmp/source'
  test "$(find /tmp/target/cur /tmp/target/new /tmp/target/.Sent/cur /tmp/target/.Sent/new -type f | wc -l)" = 3
done
python3 /test/verify-maildir.py verify /tmp/source.json /tmp/before.json /tmp/target
python3 - <<'PY'
import pathlib, hashlib
source = pathlib.Path('/tmp/source')
target = pathlib.Path('/tmp/target')
def messages(root):
    return {hashlib.sha256(p.read_bytes()).hexdigest(): p for p in root.rglob('*') if p.is_file() and p.parent.name in ('cur', 'new')}
before, after = messages(source), messages(target)
assert before.keys() <= after.keys()
for digest, path in before.items():
    assert int(path.stat().st_mtime) == int(after[digest].stat().st_mtime)
    assert path.name.split(':2,')[1] == after[digest].name.split(':2,')[1]
assert 'Sent' in (target / 'subscriptions').read_text()
print('PASS: source preserved, target message kept, folder/flags/dates preserved, repeated sync has no duplicates')
PY
