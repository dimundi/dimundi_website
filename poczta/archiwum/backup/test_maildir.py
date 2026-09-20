import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('backup-maildir.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class ArchiveTest(unittest.TestCase):
    def test_valid_and_truncated(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.tar.gz'
            with tarfile.open(str(path), 'w:gz') as archive:
                entry = tarfile.TarInfo('Maildir/cur/message:2,S')
                entry.size = 5
                archive.addfile(entry, io.BytesIO(b'hello'))
            self.assertEqual(backup.verify_archive(path), (1, 5))
            path.write_bytes(path.read_bytes()[:-8])
            with self.assertRaises((EOFError, OSError, tarfile.TarError)):
                backup.verify_archive(path)

    def test_reject_trash(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.tar.gz'
            with tarfile.open(str(path), 'w:gz') as archive:
                archive.addfile(tarfile.TarInfo('Maildir/.Trash/cur/message'))
            with self.assertRaises(RuntimeError):
                backup.verify_archive(path)


if __name__ == '__main__':
    unittest.main()
