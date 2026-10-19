"""One live call against the published valid sample. Skips when offline."""

import json
import os
import socket
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "cli" / "src"
SAMPLE = ROOT / "samples" / "valid-xrechnung-ubl.xml"


def online():
    try:
        connection = socket.create_connection(("checkxrechnung.com", 443), timeout=5)
    except OSError:
        return False
    connection.close()
    return True


class ValidSampleTest(unittest.TestCase):
    def test_valid_sample_exits_zero(self):
        if not online():
            self.skipTest("offline; skipped live API call")
        env = os.environ.copy()
        env["PYTHONPATH"] = str(SRC)
        proc = subprocess.run(
            [sys.executable, "-m", "xrechnung_check", str(SAMPLE), "--json"],
            cwd=ROOT,
            env=env,
            text=True,
            capture_output=True,
            timeout=120,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr or proc.stdout)
        report = json.loads(proc.stdout)
        self.assertIs(report["valid"], True)
        self.assertEqual(report["errors"], [])
        self.assertTrue(report.get("hasXml"))


if __name__ == "__main__":
    unittest.main()
