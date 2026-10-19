import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "cli" / "src"))

from xrechnung_check.client import format_report, normalize  # noqa: E402


class NormalizeTests(unittest.TestCase):
    def test_derives_rule_url(self):
        result = normalize(
            {
                "ok": False,
                "fileName": "invalid-xrechnung-ubl.xml",
                "hasXml": True,
                "syntax": "UBL Invoice",
                "summary": {"errors": 1, "warnings": 0},
                "issues": [
                    {
                        "severity": "error",
                        "code": "BR-DE-15",
                        "location": "/Invoice",
                        "message": "Buyer reference is required.",
                    }
                ],
            }
        )
        self.assertFalse(result["valid"])
        self.assertEqual(result["errors"][0]["rule_id"], "BR-DE-15")
        self.assertEqual(result["errors"][0]["rule_url"], "https://checkxrechnung.com/fehler/br-de-15")
        text = format_report(result)
        self.assertIn("BR-DE-15 error /Invoice", text)
        self.assertIn("rule_url: https://checkxrechnung.com/fehler/br-de-15", text)

    def test_keeps_api_rule_url(self):
        result = normalize(
            {
                "ok": True,
                "issues": [{"code": "BR-08", "rule_url": "https://checkxrechnung.com/fehler/br-08", "severity": "warning"}],
            }
        )
        self.assertTrue(result["valid"])
        self.assertEqual(result["errors"][0]["rule_url"], "https://checkxrechnung.com/fehler/br-08")


if __name__ == "__main__":
    unittest.main()
