# xrechnung-check

Command-line client for the free, keyless XRechnung / ZUGFeRD validator API.

```bash
pip install xrechnung-check
xrechnung-check invoice.xml
xrechnung-check invoice.xml --json
```

Until the package is on PyPI, install it from a checkout:

```bash
pip install ./cli
```

`FILE` is an XRechnung XML document (UBL or CII) or a ZUGFeRD PDF. The command posts it as multipart field `file` to `https://checkxrechnung.com/v1/validate`. Python 3.9+. The only dependency is `requests`.

No API key. Free limit: 50 validations per IP per UTC day, 10 per minute, 5 MB maximum. HTTP 429 carries `Retry-After`. Higher volume: https://checkxrechnung.com/api-waitlist

Human output lists each issue with its rule id and `rule_url`. If the API omits `rule_url`, the CLI uses `https://checkxrechnung.com/fehler/<code>` (lowercase). `--json` prints a normalized report: `valid`, `errors[]` with `rule_id` and `rule_url`, plus summary fields from the API.

| Exit | Meaning |
| --- | --- |
| 0 | `ok` was true |
| 1 | the file is invalid, or it is not an e-invoice |
| 2 | usage error, unreadable file, or the API could not be reached |

Docs: https://checkxrechnung.com/en/docs · Rules: https://checkxrechnung.com/fehler/ · OpenAPI: https://checkxrechnung.com/openapi.json

MIT. Copyright (c) 2026 Bobook Limited.
