# xrechnung-validator-mcp

Stdio MCP server, package version 0.2.0. Tools:

- `validate_xrechnung` uploads an XRechnung XML file (UBL or CII) or a ZUGFeRD PDF to `POST https://checkxrechnung.com/v1/validate` (`file_path` or `xml`).
- `validate_zugferd` uploads a PDF to `POST https://checkxrechnung.com/v1/zugferd/validate` (`file_path`). PDF/A-3 check, profile, EN 16931 CII Schematron, `rule_url`.
- `extract_zugferd` uploads a PDF to `POST https://checkxrechnung.com/v1/zugferd/extract` (`file_path`) and returns the raw XML plus a JSON summary.

The free limit is shared: 50 requests per IP per UTC day, 10 per minute. XML validation is 5 MB. The ZUGFeRD tools are 10 MB.

`validate_xrechnung` takes exactly one of `file_path` or `xml`. `validate_zugferd` and `extract_zugferd` take `file_path` only.

Validation output is `valid` plus `errors[]`. Each error has `rule_id`, `severity`, `location`, `message`, `hint`, and `rule_url` when a rule code is present. `rule_url` is the API value when the response includes `rule_url` or `ruleUrl`; otherwise `https://checkxrechnung.com/fehler/<code>` (lowercase). `extract_zugferd` returns `ok`, `summary`, and `xml`.

The service reports `persisted: false`. The tools call the network, so they are not a local read-only check. Batch volume: https://checkxrechnung.com/api-waitlist

Package name: `xrechnung-validator-mcp`. Registry name in [`server.json`](server.json): `io.github.wenboteng/xrechnung-validator` (`mcpName` matches). Not submitted to the MCP registry yet. Build with `npm run build` (`node dist/index.js`) or, after publish, `npx -y xrechnung-validator-mcp`.

## Claude Desktop

`claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

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

## Cursor

`~/.cursor/mcp.json` or the project file `.cursor/mcp.json`:

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

From a checkout, before the npm publish:

```json
{
  "mcpServers": {
    "xrechnung-validator": {
      "command": "node",
      "args": ["mcp/dist/index.js"]
    }
  }
}
```

## VS Code

`.vscode/mcp.json`:

```json
{
  "servers": {
    "xrechnung-validator": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "xrechnung-validator-mcp"]
    }
  }
}
```

Docs: https://checkxrechnung.com/en/docs · Rules: https://checkxrechnung.com/fehler/ · OpenAPI: https://checkxrechnung.com/openapi.json

MIT. Copyright (c) 2026 Bobook Limited.
