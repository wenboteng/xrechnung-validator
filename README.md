# XRechnung / ZUGFeRD validator — free API, CLI, and MCP server

Client tools for the free, keyless validator at [checkxrechnung.com](https://checkxrechnung.com). Send one XRechnung XML file (UBL or CII) or a ZUGFeRD PDF and get EN 16931 / XRechnung rule results back. The API runs the KoSIT validator with the official XRechnung configuration.

This repository is only the public client: CLI, MCP server, OpenAPI copy, samples, and examples. It does not contain the validator engine.

The file is uploaded to `POST https://checkxrechnung.com/v1/validate` for that request. The service reports `persisted: false`.

## Free limits

| Limit | Value |
| --- | --- |
| API key | none |
| Per IP per UTC day | 50 validations |
| Per minute | 10 |
| Max upload | 5 MB on `POST /v1/validate`. 10 MB on `POST /v1/zugferd/validate` and `POST /v1/zugferd/extract` |
| Over the daily or minute limit | HTTP 429 and `Retry-After` |
| Over 5 MB | HTTP 413 |

Batch and higher volume: [API waitlist](https://checkxrechnung.com/api-waitlist) (joining is free). Docs: [English](https://checkxrechnung.com/en/docs), [Deutsch](https://checkxrechnung.com/docs). Machine-readable contract: [openapi.json](https://checkxrechnung.com/openapi.json) (copy in [`openapi/openapi.json`](openapi/openapi.json)).

A file can pass here and still be rejected by a portal such as ZRE or OZG-RE. This is not a Peppol access point and not legal or tax advice.

## curl

UBL, using the published valid sample:

```bash
curl -F "file=@samples/valid-xrechnung-ubl.xml" https://checkxrechnung.com/v1/validate
```

CII uses the same endpoint and the same `file` field. Point it at a Cross Industry Invoice XML file:

```bash
curl -F "file=@invoice-cii.xml" https://checkxrechnung.com/v1/validate
```

[`examples/curl.sh`](examples/curl.sh) wraps the same request. The public sample set below is UBL plus a PDF; it does not include a CII file.

## Sample request and response

Request:

```bash
curl -F "file=@samples/invalid-xrechnung-ubl.xml" https://checkxrechnung.com/v1/validate
```

The invalid sample is published as failing. The [API docs](https://checkxrechnung.com/en/docs) show this shape (first issue only; the full report has more):

```json
{
  "ok": false,
  "persisted": false,
  "fileName": "invalid-xrechnung-ubl.xml",
  "bytes": 2496,
  "hasXml": true,
  "syntax": "UBL Invoice",
  "invoiceType": "XRechnung",
  "summary": { "errors": 14, "warnings": 0 },
  "versions": {
    "product": "RechnungCheck",
    "domain": "checkxrechnung.com",
    "xrechnung": "3.0.2",
    "kosit_validator": "1.6.3",
    "kosit_configuration": "2026-08-31",
    "en16931_schematron": "1.3.16"
  },
  "issues": [
    {
      "severity": "error",
      "code": "BR-08",
      "location": "/Invoice",
      "message": "[BR-08]-An Invoice shall contain the Seller postal address.",
      "hint": "Die Verkäuferanschrift (BG-5) fehlt. StreetName, CityName, PostalZone und Country/IdentificationCode setzen.",
      "source": "kosit"
    }
  ]
}
```

`ok: true` means the file passed. The CLI and MCP server map that to `valid`, and map each issue's `code` to `rule_id`. When the response includes `rule_url` (or `ruleUrl`), that URL is kept. Otherwise the tools link the public rule page `https://checkxrechnung.com/fehler/<code>` in lowercase. Some rule pages are not published yet.

## Samples

Downloaded from [checkxrechnung.com/samples](https://checkxrechnung.com/samples). Synthetic data, not real invoices.

| File | What the site says to expect |
| --- | --- |
| [`samples/valid-xrechnung-ubl.xml`](samples/valid-xrechnung-ubl.xml) | Valid XRechnung 3.0 UBL. Pass, no errors. |
| [`samples/invalid-xrechnung-ubl.xml`](samples/invalid-xrechnung-ubl.xml) | Missing required data. Fail, 14 errors, including BR-08 and BR-DE-15. |
| [`samples/plain-invoice.pdf`](samples/plain-invoice.pdf) | PDF with no embedded XML. Not an e-invoice. |
| [`samples/factur-x-en16931.pdf`](samples/factur-x-en16931.pdf) | Synthetic Factur-X PDF, profile EN16931. `xrechnung-check zugferd` expects a pass. |
| [`samples/factur-x-en16931-invalid.pdf`](samples/factur-x-en16931-invalid.pdf) | Same profile, seller address removed. Expect BR-08 and BR-09 with `rule_url`. |
| [`samples/factur-x-minimum.pdf`](samples/factur-x-minimum.pdf) | Profile MINIMUM. EN 16931 CII rules can fail a correct subset. |
| [`samples/zugferd-xrechnung.pdf`](samples/zugferd-xrechnung.pdf) | Profile XRECHNUNG, embedded `xrechnung.xml`. |

## CLI

Python 3.9+, package `xrechnung-check`. The only dependency is `requests`.

```bash
pip install ./cli
xrechnung-check samples/valid-xrechnung-ubl.xml
xrechnung-check samples/invalid-xrechnung-ubl.xml --json
xrechnung-check zugferd samples/factur-x-en16931.pdf
xrechnung-check extract samples/factur-x-en16931.pdf --json
```

`zugferd` posts the PDF to `POST /v1/zugferd/validate` (PDF/A-3 check, profile, EN 16931 CII Schematron, `rule_url`). `extract` posts it to `POST /v1/zugferd/extract` and prints the raw XML plus the JSON summary. Both share the free counter with `POST /v1/validate`. The PDF limit is 10 MB.

Node 18+, package `xrechnung-check`, no dependencies:

```bash
npx ./cli-node samples/valid-xrechnung-ubl.xml
node cli-node/bin/xrechnung-check.js samples/invalid-xrechnung-ubl.xml --json
node cli-node/bin/xrechnung-check.js zugferd samples/factur-x-en16931.pdf
```

Human output prints each issue with its rule id and `rule_url`. `--json` prints the normalized report. Exit `0` when `valid` is true, `1` when the file fails or is not an e-invoice, `2` on usage, file, or HTTP errors (including 413 and 429).

After publish, the same commands are `pip install xrechnung-check` and `npx xrechnung-check file.xml`. They are not on PyPI or npm yet. See [Publishing](#publishing).

## MCP server

[`mcp/`](mcp/) is a stdio MCP server, package `xrechnung-validator-mcp` 0.2.0. Tools: `validate_xrechnung` (`file_path` or `xml`), `validate_zugferd` (`file_path`), and `extract_zugferd` (`file_path`). Validation results are `valid` plus `errors[]` (`rule_id`, `severity`, `location`, `message`, `hint`, `rule_url`). Extract returns `ok`, `profile`, `summary`, and the raw `xml`.

Registry metadata is in [`mcp/server.json`](mcp/server.json) (`io.github.wenboteng/xrechnung-validator`). Config snippets for Claude Desktop, Cursor, and VS Code are in [`mcp/README.md`](mcp/README.md). Not submitted to the MCP registry yet.

## Examples

Short snippets that post the `file` field. Each run spends one free validation.

| Language | File |
| --- | --- |
| curl | [`examples/curl.sh`](examples/curl.sh) |
| Python (`requests`) | [`examples/python_requests.py`](examples/python_requests.py) |
| Node (`fetch`) | [`examples/node_fetch.mjs`](examples/node_fetch.mjs) |
| PHP | [`examples/validate.php`](examples/validate.php) |
| C# | [`examples/Program.cs`](examples/Program.cs) |
| Java | [`examples/Validate.java`](examples/Validate.java) |

## Links

- Docs: [https://checkxrechnung.com/en/docs](https://checkxrechnung.com/en/docs) and [https://checkxrechnung.com/docs](https://checkxrechnung.com/docs)
- OpenAPI: [https://checkxrechnung.com/openapi.json](https://checkxrechnung.com/openapi.json)
- Rule and error pages: [https://checkxrechnung.com/fehler/](https://checkxrechnung.com/fehler/)
- API waitlist: [https://checkxrechnung.com/api-waitlist](https://checkxrechnung.com/api-waitlist)
- Samples on the site: [https://checkxrechnung.com/samples](https://checkxrechnung.com/samples)

## Deutsch

Kostenlose Client-Werkzeuge für die Prüfung von XRechnung (UBL und CII) und ZUGFeRD auf [checkxrechnung.com](https://checkxrechnung.com). Kein API-Schlüssel. Dieses Repository enthält nur Clients, Beispiele und die öffentliche OpenAPI-Datei, nicht die Validator-Engine.

Die Datei geht an `POST https://checkxrechnung.com/v1/validate` und wird für diese eine Anfrage geprüft. Die Antwort enthält `persisted: false`.

Grenzen: 50 Prüfungen pro IP und UTC-Tag, höchstens 10 pro Minute, gemeinsamer Zähler. `POST /v1/validate` maximal 5 MB, die ZUGFeRD-Endpunkte maximal 10 MB. Darüber HTTP 429 mit `Retry-After`, bei zu großen Dateien HTTP 413. Batch und höheres Volumen über die [Warteliste](https://checkxrechnung.com/api-waitlist).

ZUGFeRD / Factur-X:

```bash
curl -F "file=@samples/factur-x-en16931.pdf" https://checkxrechnung.com/v1/zugferd/validate
xrechnung-check zugferd samples/factur-x-en16931.pdf
xrechnung-check extract samples/factur-x-en16931.pdf
```

UBL:

```bash
curl -F "file=@samples/valid-xrechnung-ubl.xml" https://checkxrechnung.com/v1/validate
```

CII, gleiche Schnittstelle, andere Datei:

```bash
curl -F "file=@invoice-cii.xml" https://checkxrechnung.com/v1/validate
```

Die Beispieldateien unter [`samples/`](samples/) stammen von [checkxrechnung.com/samples](https://checkxrechnung.com/samples): gültige XRechnung-UBL, ungültige XRechnung-UBL (14 Fehler, unter anderem BR-08 und BR-DE-15) und ein PDF ohne XML.

CLI: `xrechnung-check datei.xml` (Python) oder `npx xrechnung-check datei.xml` (Node, nach Veröffentlichung). Exit-Code 0 bei gültig, 1 bei ungültig, 2 bei Aufruf- oder HTTP-Fehler. `--json` gibt den normalisierten Bericht aus, inklusive Regel-ID und `rule_url`.

Links: [API-Doku](https://checkxrechnung.com/docs), [englische Doku](https://checkxrechnung.com/en/docs), [OpenAPI](https://checkxrechnung.com/openapi.json), [Fehler-Codes](https://checkxrechnung.com/fehler/), [Warteliste](https://checkxrechnung.com/api-waitlist).

Ein bestandener Check kann bei ZRE, OZG-RE oder einem anderen Portal trotzdem scheitern. Kein Peppol-Zugang und keine Rechts- oder Steuerberatung.

## Development

GitHub Actions lints the Python and Node clients, typechecks the MCP server, boots it over stdio, and runs one live check of the valid sample. That live check skips when `checkxrechnung.com:443` cannot be reached.

```bash
python -m pip install ./cli
python -m unittest discover -s tests -p 'test_*.py' -v
node --test cli-node/test
cd mcp && npm ci && npm run build && node --test test && node scripts/stdio-smoke.mjs
```

`node mcp/scripts/stdio-smoke.mjs samples/invalid-xrechnung-ubl.xml` performs one extra live tool call. Do not loop it: the free quota is 50 per IP per UTC day.

## Publishing

Nothing in this repo is on npm, PyPI, or the MCP registry yet. Names checked while preparing this tree: `xrechnung-check` (PyPI and npm) and `xrechnung-validator-mcp` (npm) were unused. Do not publish from CI.

PyPI, from a machine logged in via `~/.pypirc` or an API token:

```bash
cd cli
python -m pip install build twine
python -m build
python -m twine upload dist/*
```

npm CLI (unscoped package, public by default):

```bash
cd cli-node
npm login
npm publish
```

npm MCP server. `npm publish` runs `prepack`, which compiles TypeScript. Publish this package before the registry entry, because the registry checks `mcpName` in the published `package.json`.

```bash
cd mcp
npm login
npm publish
```

MCP registry, only after that npm publish. Use the official `mcp-publisher` binary from [modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry), not the unrelated npm package named `mcp-publisher`.

```bash
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
sudo mv mcp-publisher /usr/local/bin/
cd mcp
mcp-publisher validate server.json
mcp-publisher login github
mcp-publisher publish
```

GitHub repository this metadata points at:

```bash
gh repo create wenboteng/xrechnung-validator --public --source=. --remote=origin \
  --description "Free XRechnung / ZUGFeRD (EN 16931) validator API — CLI, MCP server, examples. Powered by checkxrechnung.com" \
  --push
gh repo edit wenboteng/xrechnung-validator \
  --add-topic xrechnung --add-topic zugferd --add-topic e-invoicing --add-topic en16931 \
  --add-topic validator --add-topic mcp --add-topic einvoice --add-topic germany
```

## License

MIT. Copyright (c) 2026 Bobook Limited. See [LICENSE](LICENSE).

The API is operated by Bobook Limited. Contact published on the service: info@bobook.club.
