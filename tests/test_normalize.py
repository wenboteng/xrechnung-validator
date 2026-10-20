import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "cli" / "src"))

from xrechnung_check.client import format_extract, format_report, normalize, normalize_extract  # noqa: E402


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

    def test_zugferd_profile_and_extract(self):
        result = normalize(
            {
                "ok": False,
                "profile": "EN16931",
                "embeddedName": "factur-x.xml",
                "pdfa": {"engine": "structure", "label": "PDF/A-3 structure check (not veraPDF)", "ok": True},
                "issues": [{"code": "BR-08", "rule_url": "https://checkxrechnung.com/fehler/br-08", "severity": "error"}],
            }
        )
        self.assertEqual(result["profile"], "EN16931")
        self.assertEqual(result["pdfa"]["engine"], "structure")
        self.assertIn("profile: EN16931", format_report(result))
        extracted = normalize_extract(
            {
                "ok": True,
                "fileName": "factur-x-en16931.pdf",
                "profile": "EN16931",
                "embeddedName": "factur-x.xml",
                "summary": {"invoiceNumber": "RX-2026-001", "grandTotal": "119.00"},
                "xml": "<rsm:CrossIndustryInvoice/>",
            }
        )
        self.assertTrue(extracted["ok"])
        text = format_extract(extracted)
        self.assertIn("RX-2026-001", text)
        self.assertIn("<rsm:CrossIndustryInvoice/>", text)


if __name__ == "__main__":
    unittest.main()
