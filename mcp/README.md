# xrechnung-validator-mcp

Stdio MCP server with one tool, `validate_xrechnung`. It uploads an XRechnung XML file (UBL or CII) or a ZUGFeRD PDF to the free keyless API `POST https://checkxrechnung.com/v1/validate`.

Input: exactly one of `file_path` (read by this process) or `xml` (the document as a string).

Output: `valid` plus `errors[]`. Each error has `rule_id`, `severity`, `location`, `message`, `hint`, and `rule_url` when a rule code is present. `rule_url` is the API value when the response includes `rule_url` or `ruleUrl`; otherwise `https://checkxrechnung.com/fehler/<code>` (lowercase).

Free limit: 50 requests per IP per UTC day, 10 per minute, 5 MB. The service reports `persisted: false`. The tool calls the network, so it is not a local read-only check. Batch volume: https://checkxrechnung.com/api-waitlist

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
