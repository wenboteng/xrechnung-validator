import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "cli" / "src"))

from xrechnung_check.client import API_PRO_URL, rate_limit_message  # noqa: E402

OLD = '{"error":"rate_limit","message":"Free limit: old text.","waitlist":"https://checkxrechnung.com/api-waitlist"}'
NEW = '{"error":"rate_limit","message":"Free limit reached. Get an API Pro key: https://checkxrechnung.com/en/docs?utm_source=api&utm_medium=429&utm_campaign=api_pro#pricing","upgrade_url":"https://checkxrechnung.com/en/docs?utm_source=api&utm_medium=429&utm_campaign=api_pro#pricing"}'


class RateLimitMessageTest(unittest.TestCase):
    def test_older_server_still_links_to_api_pro(self):
        out = rate_limit_message(OLD, "42")
        self.assertTrue(out.startswith("rate limit reached (HTTP 429). Retry-After: 42s."))
        self.assertIn("Free limit: old text.", out)
        self.assertIn("API Pro", out)
        self.assertIn(API_PRO_URL, out)
        self.assertIn("utm_source=cli-python", API_PRO_URL)

    def test_server_upgrade_url_is_used_and_tagged(self):
        out = rate_limit_message(NEW, None)
        self.assertIn("ref=cli-python", out)
        self.assertIn("utm_source=api", out)
        self.assertEqual(out.count("https://"), 1)

    def test_non_json_body(self):
        out = rate_limit_message("<html>busy</html>", None)
        self.assertIn("Free limit:", out)
        self.assertIn(API_PRO_URL, out)


if __name__ == "__main__":
    unittest.main()
