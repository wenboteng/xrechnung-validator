import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "cli" / "src"


def run_cli(*args):
    env = os.environ.copy()
    env["PYTHONPATH"] = str(SRC)
    return subprocess.run(
        [sys.executable, "-m", "xrechnung_check", *args],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=30,
    )


class CliOfflineTests(unittest.TestCase):
    def test_help(self):
        proc = run_cli("--help")
        self.assertEqual(proc.returncode, 0)
        self.assertIn("https://checkxrechnung.com/v1/validate", proc.stdout)
        self.assertIn("zugferd", proc.stdout)
        self.assertIn("extract", proc.stdout)

    def test_zugferd_help_and_missing_file(self):
        proc = run_cli("zugferd", "--help")
        self.assertEqual(proc.returncode, 0)
        self.assertIn("/v1/zugferd/validate", proc.stdout)
        missing = run_cli("extract", "no-such-invoice.pdf")
        self.assertEqual(missing.returncode, 2)
        self.assertIn("file not found", missing.stderr)

    def test_extract_rejects_over_10_mb_without_calling_the_api(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "big.pdf"
            path.write_bytes(b"%PDF-" + b"x" * (10 * 1024 * 1024))
            proc = run_cli("extract", str(path))
        self.assertEqual(proc.returncode, 2)
        self.assertIn("10 MB", proc.stderr)

    def test_missing_file(self):
        proc = run_cli("no-such-invoice.xml")
        self.assertEqual(proc.returncode, 2)
        self.assertIn("file not found", proc.stderr)

    def test_empty_file_does_not_call_the_api(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "empty.xml"
            path.write_bytes(b"")
            proc = run_cli(str(path))
        self.assertEqual(proc.returncode, 2)
        self.assertIn("empty file", proc.stderr)


if __name__ == "__main__":
    unittest.main()
