"""Back up a Maildir directly over SSH; never write to the source VPS."""
import argparse
import datetime
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import time


def verify_archive(path):
    count = total = 0
    last_update = time.monotonic()
    with tarfile.open(str(path), 'r|gz') as archive:
        for entry in archive:
            name = PurePosixPath(entry.name)
            if name.is_absolute() or '..' in name.parts or not name.parts or name.parts[0] != 'Maildir':
                raise RuntimeError('Unexpected archive path')
            if len(name.parts) > 1 and (name.parts[1] == '.Trash' or name.parts[1].startswith('.Trash.')):
                raise RuntimeError('Trash should have been excluded')
            if not entry.isdir() and not entry.isfile():
                raise RuntimeError('Unexpected link or special file; review required')
            if entry.isfile():
                read = 0
                with archive.extractfile(entry) as source:
                    while True:
                        chunk = source.read(1024 * 1024)
                        if not chunk:
                            break
                        read += len(chunk)
                        if time.monotonic() - last_update >= 2:
                            print('\rSprawdzanie TAR: %.2f GB, %d wiadomosci' %
                                  ((total + read) / 1e9, count), end='', flush=True)
                            last_update = time.monotonic()
                if read != entry.size:
                    raise RuntimeError('Truncated archive entry')
                total += read
                if name.parent.name in ('cur', 'new'):
                    count += 1
    print('\nSprawdzanie CRC gzip...', flush=True)
    # Read through the gzip trailer too, checking CRC and truncation.
    with gzip.open(str(path), 'rb') as source:
        while source.read(1024 * 1024):
            pass
    return count, total


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', required=True)
    parser.add_argument('--account', choices=('beata', 'marcin'), default='beata')
    args = parser.parse_args()
    root = Path(args.destination) / (args.account.capitalize() + '-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    root.mkdir(parents=True, exist_ok=False)
    report = {'status': 'incomplete', 'source': args.account + '@51.178.19.126:~/Maildir',
              'excluded_folders': ['.Trash', '.Trash.*']}
    report_path = root / 'report.json'

    def save():
        report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')

    save()
    try:
        print('Kopia plikow konta ' + args.account + ': ' + str(root), flush=True)
        print('Pominiety kosz .Trash i jego podfoldery. Wpisz haslo SSH konta ' + args.account + '.', flush=True)
        # No remote temporary archive: binary stdout streams directly to disk.
        command = 'test "$(id -un)" = ' + args.account + ' && cd "$HOME" && test -d Maildir/cur && test -d Maildir/new && '
        command += "tar --create --gzip --file=- --anchored --exclude='Maildir/.Trash' --exclude='Maildir/.Trash.*' -- Maildir"
        partial = root / 'Maildir.tar.gz.part'
        windows = Path(os.environ.get('WINDIR', r'C:\Windows'))
        # A 32-bit Python needs Sysnative to launch the Windows OpenSSH client.
        ssh = windows / 'Sysnative/OpenSSH/ssh.exe'
        if not ssh.is_file():
            ssh = windows / 'System32/OpenSSH/ssh.exe'
        with partial.open('xb') as output:
            process = subprocess.Popen([str(ssh), '-T', '-o', 'StrictHostKeyChecking=yes',
                                      '-o', 'PreferredAuthentications=keyboard-interactive,password',
                                      '-o', 'PubkeyAuthentication=no', '-o', 'ServerAliveInterval=15',
                                      '-o', 'ServerAliveCountMax=3', args.account + '@51.178.19.126', command], stdout=output)
            started = previous_time = time.monotonic()
            previous_size = 0
            try:
                while process.poll() is None:
                    time.sleep(2)
                    now = time.monotonic()
                    downloaded = partial.stat().st_size
                    if downloaded:
                        elapsed = int(now - started)
                        speed = (downloaded - previous_size) / (now - previous_time) / 1e6
                        print('\rPobrano: %.2f GB | %.1f MB/s | czas: %02d:%02d:%02d   ' %
                              (downloaded / 1e9, speed, elapsed // 3600, elapsed // 60 % 60, elapsed % 60),
                              end='', flush=True)
                    previous_size, previous_time = downloaded, now
                result = process.returncode
            except BaseException:
                process.terminate()
                process.wait()
                raise
            print('', flush=True)
        if result != 0:
            raise RuntimeError('SSH/tar exit %d; archive not accepted as complete' % result)
        print('Sprawdzam archiwum i sume kontrolna...', flush=True)
        count, size = verify_archive(partial)
        print('Obliczanie SHA-256...', flush=True)
        digest = hashlib.sha256()
        with partial.open('rb') as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(chunk)
        final = root / 'Maildir.tar.gz'
        partial.rename(final)
        (root / 'SHA256SUMS.txt').write_text(digest.hexdigest() + '  Maildir.tar.gz\n', encoding='ascii')
        report.update(status='archive_verified', messages=count, unpacked_file_bytes=size,
                      archive_bytes=final.stat().st_size, sha256=digest.hexdigest())
        save()
        print('GOTOWE: %d wiadomosci. %s' % (count, final), flush=True)
        return 0
    except (Exception, KeyboardInterrupt) as error:
        report['error'] = str(error)
        save()
        print('KOPIA NIEUKONCZONA: ' + str(error), flush=True)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
