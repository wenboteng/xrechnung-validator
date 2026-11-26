# Install

No API key. The tools call the public check at https://checkxrechnung.com.

Free limit, shared by every tool: 50 checks per IP per UTC day, and 10 per minute. XML for `validate_xrechnung` is at most 5 MB. A ZUGFeRD or Factur-X PDF is at most 10 MB. Past the limit the service returns HTTP 429. A larger file returns HTTP 413.

Registry: `io.github.wenboteng/xrechnung-validator`.

```json
{
  "mcpServers": {
    "xrechnung-validator": {
      "command": "npx",
      "args": ["-y", "xrechnung-validator-mcp"]
    }
  }
}
```

Python CLI, same service: `pip install xrechnung-check`.

What each tool returns:

- `validate_xrechnung` (`file_path` or `xml`): `valid`, and `errors[]` with `rule_id`, `severity`, `location`, `message`, `hint`, and `rule_url` when the code has a page.
- `validate_zugferd` (`file_path`): `valid`, `profile`, and `errors[]` with `rule_id` and `rule_url`.
- `extract_zugferd` (`file_path`): `ok` (an XML attachment was found), `profile`, `summary`, and `xml` (the raw document).
