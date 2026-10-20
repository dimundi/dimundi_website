"""Run on VPS over SSH: stream a read-only OVH IMAP backup to binary stdout."""
import base64
import hashlib
import imaplib
import io
import json
from pathlib import Path
import re
import sys
import tarfile
import time


def mailbox_name(token):
    value = token.decode('ascii')
    if value.startswith('"') and value.endswith('"'):
        value = value[1:-1].replace('\\"', '"').replace('\\\\', '\\')

    def decode(match):
        text = match.group(1)
        if not text:
            return '&'
        raw = base64.b64decode(text.replace(',', '/') + '=' * (-len(text) % 4))
        return raw.decode('utf-16-be')

    return re.sub(r'&([^-]*)-', decode, value)


def add_bytes(archive, name, data):
    entry = tarfile.TarInfo(name)
    entry.size = len(data)
    entry.mode = 0o600
    entry.mtime = int(time.time())
    archive.addfile(entry, io.BytesIO(data))


def add_json(archive, name, data):
    add_bytes(archive, name, json.dumps(data, ensure_ascii=True, indent=2).encode('utf-8'))


def main():
    password = Path('/home/docker/dimundi/whatthefrog/secrets/ovh-biuro-password').read_text().rstrip('\r\n')
    if not password:
        raise RuntimeError('Empty OVH password file')
    summary = dict(source='biuro@whatthefrog.pl', host='ex5.mail.ovh.net',
                   excluded_roots=['Trash', 'Elementy usunięte'],
                   messages=0, message_bytes=0, size_metadata_differences=0, folders=[], excluded=[])
    with imaplib.IMAP4_SSL(summary['host'], 993, timeout=90) as server:
        server.login(summary['source'], password)
        del password
        status, rows = server.list()
        if status != 'OK':
            raise RuntimeError('IMAP LIST failed')
        with tarfile.open(fileobj=sys.stdout.buffer, mode='w|gz') as archive:
            for index, row in enumerate(rows):
                if not isinstance(row, bytes):
                    raise RuntimeError('Unsupported literal in IMAP LIST')
                match = re.match(rb'^\(([^)]*)\) ("(?:[^"\\]|\\.)*"|NIL) (.+)$', row)
                if not match:
                    raise RuntimeError('Unsupported IMAP LIST response')
                flags, delimiter_token, token = match.groups()
                name = mailbox_name(token)
                delimiter = mailbox_name(delimiter_token) if delimiter_token != b'NIL' else None
                trash = any(name.casefold() == root.casefold() or (
                    delimiter and name.casefold().startswith(root.casefold() + delimiter)
                ) for root in summary['excluded_roots'])
                if trash or b'\\trash' in flags.lower():
                    summary['excluded'].append(name)
                    print('EXCLUDED: ' + name, file=sys.stderr, flush=True)
                    continue
                if b'\\noselect' in flags.lower():
                    continue
                status, _ = server.select(token, readonly=True)
                if status != 'OK':
                    raise RuntimeError('IMAP EXAMINE failed: ' + name)
                uidvalidity = server.response('UIDVALIDITY')[1][0]
                status, ids = server.uid('search', None, 'ALL')
                if status != 'OK':
                    raise RuntimeError('UID SEARCH failed: ' + name)
                uids = ids[0].split()
                folder = dict(name=name, delimiter=delimiter,
                              uidvalidity=uidvalidity.decode('ascii'),
                              path=f'messages/f{index:04d}', messages=[], message_bytes=0)
                print(f'FOLDER: {name} ({len(uids)} messages)', file=sys.stderr, flush=True)
                for offset in range(0, len(uids), 20):
                    wanted = uids[offset:offset + 20]
                    status, records = server.uid('fetch', b','.join(wanted),
                                                 '(UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[])')
                    if status != 'OK':
                        raise RuntimeError('UID FETCH failed: ' + name)
                    found = set()
                    for record in records:
                        if not isinstance(record, tuple):
                            continue
                        header, body = record
                        uid = re.search(rb'\bUID (\d+)', header).group(1)
                        reported_size = int(re.search(rb'RFC822.SIZE (\d+)', header).group(1))
                        literal_size = int(re.search(rb'\{(\d+)\}$', header).group(1))
                        size = len(body)
                        date = re.search(rb'INTERNALDATE "([^"]+)"', header).group(1).decode('ascii')
                        if uid not in wanted or uid in found or size != literal_size:
                            raise RuntimeError('Unexpected UID or message size: ' + name)
                        if size != reported_size:
                            summary['size_metadata_differences'] += 1
                        found.add(uid)
                        message_path = f"{folder['path']}/{uid.decode('ascii')}.eml"
                        add_bytes(archive, message_path, body)
                        folder['messages'].append(dict(uid=int(uid), path=message_path, bytes=size,
                            source_reported_bytes=reported_size,
                            flags=[f.decode('ascii') for f in imaplib.ParseFlags(header)],
                            internaldate=date, sha256=hashlib.sha256(body).hexdigest()))
                        folder['message_bytes'] += size
                    if found != set(wanted):
                        raise RuntimeError('Messages changed/disappeared during backup: ' + name)
                    if offset % 200 == 0:
                        print(f'PROGRESS: {name}: {min(offset + 20, len(uids))}/{len(uids)}',
                              file=sys.stderr, flush=True)
                manifest_path = f"{folder['path']}/manifest.json"
                add_json(archive, manifest_path, folder)
                summary['folders'].append(dict(name=name, manifest=manifest_path,
                    messages=len(folder['messages']), message_bytes=folder['message_bytes']))
                summary['messages'] += len(folder['messages'])
                summary['message_bytes'] += folder['message_bytes']
            summary['status'] = 'complete'
            add_json(archive, 'report.json', summary)
    print(f"COMPLETE: {summary['messages']} messages, {summary['message_bytes']} bytes",
          file=sys.stderr, flush=True)


if __name__ == '__main__':
    main()
