# xrechnung-check

Command-line client for the free, keyless XRechnung / ZUGFeRD validator API.

```bash
pip install xrechnung-check
xrechnung-check invoice.xml
xrechnung-check invoice.xml --json
xrechnung-check zugferd invoice.pdf
xrechnung-check extract invoice.pdf
```

Until the package is on PyPI, install it from a checkout:

```bash
pip install ./cli
```

`FILE` is an XRechnung XML document (UBL or CII) or a ZUGFeRD PDF. The command posts it as multipart field `file` to `https://checkxrechnung.com/v1/validate`. Python 3.9+. The only dependency is `requests`.

No API key. Free limit: 50 validations per IP per UTC day, 10 per minute, shared with the ZUGFeRD routes. `FILE` on the default command is at most 5 MB. `zugferd` and `extract` accept a PDF up to 10 MB and call `POST /v1/zugferd/validate` and `POST /v1/zugferd/extract`. HTTP 429 carries `Retry-After`. Higher volume: https://checkxrechnung.com/api-waitlist

Human output lists each failing rule code, the rule message, a one-line English hint when one is known, and `rule_url`. If the API omits `rule_url`, the CLI uses `https://checkxrechnung.com/fehler/<code>` (lowercase). `--json` prints a normalized report: `valid`, `errors[]` with `rule_id`, `message`, `hint`, and `rule_url`, plus summary fields from the API.

## What each error means

The codes below are the ones that show up most often. The linked page is the longer fix.

| Code | What to fix | Rule page |
| --- | --- | --- |
| `BR-DE-15` | Buyer reference (BT-10) is missing. For the German public sector this is often the Leitweg-ID. | https://checkxrechnung.com/fehler/br-de-15 |
| `BR-DE-1` | Payment instructions are missing. Add a payment means, usually an IBAN. | https://checkxrechnung.com/fehler/br-de-1 |
| `BR-08` | Seller postal address is missing (city, postcode, country). | https://checkxrechnung.com/fehler/br-08 |
| `BR-CO-10` | Invoice net amount does not match the sum of the lines. | https://checkxrechnung.com/fehler/br-co-10 |
| `BR-CO-15` | Gross amount must equal net plus VAT. | https://checkxrechnung.com/fehler/br-co-15 |
| `BR-S-08` | A standard-rated line needs the seller VAT ID. | https://checkxrechnung.com/fehler/br-s-08 |
| `XML-SCHEMA` | Element order, type, or a required node does not match UBL or CII. | https://checkxrechnung.com/fehler/ |
| `ZUGFERD-NO-XML` | The PDF has no embedded invoice XML. | https://checkxrechnung.com/zugferd |

The full list of rule pages starts at https://checkxrechnung.com/fehler/ . English index: https://checkxrechnung.com/en/errors/ .

| Exit | Meaning |
| --- | --- |
| 0 | `ok` was true |
| 1 | the file is invalid, or it is not an e-invoice |
| 2 | usage error, unreadable file, or the API could not be reached |

Docs: https://checkxrechnung.com/en/docs · Rules: https://checkxrechnung.com/fehler/ · OpenAPI: https://checkxrechnung.com/openapi.json

MIT. Copyright (c) 2026 Bobook Limited.
