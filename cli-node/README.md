# xrechnung-check

Node CLI for the free, keyless XRechnung / ZUGFeRD validator API. Node 18 or newer. No dependencies.

```bash
npx xrechnung-check invoice.xml
npx xrechnung-check invoice.xml --json
```

Until the package is on npm, run it from a checkout:

```bash
node cli-node/bin/xrechnung-check.js invoice.xml
npx ./cli-node invoice.xml
```

`FILE` is an XRechnung XML document (UBL or CII) or a ZUGFeRD PDF. The command posts it as multipart field `file` to `https://checkxrechnung.com/v1/validate`.

No API key. Free limit: 50 validations per IP per UTC day, 10 per minute, 5 MB maximum. HTTP 429 carries `Retry-After`. Higher volume: https://checkxrechnung.com/api-waitlist

Human output lists each issue with its rule id and `rule_url`. If the API omits `rule_url`, the CLI uses `https://checkxrechnung.com/fehler/<code>` (lowercase). `--json` prints a normalized report: `valid` and `errors[]` with `rule_id` and `rule_url`.

| Exit | Meaning |
| --- | --- |
| 0 | `ok` was true |
| 1 | the file is invalid, or it is not an e-invoice |
| 2 | usage error, unreadable file, or the API could not be reached |

Docs: https://checkxrechnung.com/en/docs · Rules: https://checkxrechnung.com/fehler/ · OpenAPI: https://checkxrechnung.com/openapi.json

MIT. Copyright (c) 2026 Bobook Limited.
