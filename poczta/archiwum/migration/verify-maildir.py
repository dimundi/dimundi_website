"""Compare Maildir contents without exposing headers or message bodies."""
import collections
import hashlib
import json
import pathlib
import sys


def inventory(root):
    result = []
    root = pathlib.Path(root)
    for directory in [root] + sorted(p for p in root.iterdir() if p.is_dir() and p.name.startswith('.')):
        folder = 'INBOX' if directory == root else directory.name[1:]
        keywords = {}
        keyword_file = directory / 'dovecot-keywords'
        if keyword_file.exists():
            for line in keyword_file.read_text().splitlines():
                index, name = line.split(' ', 1)
                keywords[chr(97 + int(index))] = name
        for state in ('cur', 'new'):
            for message in sorted((directory / state).glob('*')):
                if not message.is_file():
                    continue
                flags = message.name.split(':2,', 1)[1].split(',', 1)[0] if ':2,' in message.name else ''
                digest = hashlib.sha256()
                with message.open('rb') as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                        digest.update(chunk)
                result.append([folder, digest.hexdigest(), int(message.stat().st_mtime),
                               sorted(keywords.get(f, f) for f in flags)])
    return result


def counts(rows, metadata=True):
    return collections.Counter((r[0], r[1], r[2], tuple(r[3])) if metadata else (r[0], r[1]) for r in rows)


if sys.argv[1] == 'snapshot':
    print(json.dumps(inventory(sys.argv[2])))
elif sys.argv[1] == 'verify':
    source = json.loads(pathlib.Path(sys.argv[2]).read_text())
    before = json.loads(pathlib.Path(sys.argv[3]).read_text())
    after = inventory(sys.argv[4])
    missing = counts(source) - counts(after)
    lost_existing = counts(before, False) - counts(after, False)
    report = {'status': 'verified' if not missing and not lost_existing else 'verification_failed',
              'source_messages': len(source), 'target_before': len(before), 'target_after': len(after),
              'missing_source_or_metadata_mismatch': sum(missing.values()),
              'missing_existing': sum(lost_existing.values()),
              'source_folders': dict(collections.Counter(row[0] for row in source)),
              'target_folders': dict(collections.Counter(row[0] for row in after))}
    print(json.dumps(report, indent=2))
    sys.exit(0 if report['status'] == 'verified' else 1)
else:
    raise SystemExit('Unknown mode')
