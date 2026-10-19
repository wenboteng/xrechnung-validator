/**
 * Boot the MCP server over stdio and list tools.
 * Pass a file path to also call validate_xrechnung (one live API request).
 *
 *   node scripts/stdio-smoke.mjs
 *   node scripts/stdio-smoke.mjs /path/to/invoice.xml
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const file = process.argv[2];

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [server],
  stderr: "inherit",
});
const client = new Client({ name: "xrechnung-validator-smoke", version: "0.1.0" });
await client.connect(transport);

const listed = await client.listTools();
const names = (listed.tools || []).map((tool) => tool.name);
if (!names.includes("validate_xrechnung")) {
  console.error("missing tool validate_xrechnung:", names.join(", "));
  await client.close();
  process.exit(1);
}
console.log("tools:", names.join(", "));

if (file) {
  const result = await client.callTool({
    name: "validate_xrechnung",
    arguments: { file_path: file },
  });
  const text = (result.content || []).map((block) => (block.type === "text" ? block.text : "")).join("\n");
  process.stdout.write(text.endsWith("\n") ? text : text + "\n");
  if (result.isError) {
    await client.close();
    process.exit(1);
  }
  const report = JSON.parse(text);
  if (typeof report.valid !== "boolean" || !Array.isArray(report.errors)) {
    console.error("report missing valid or errors");
    await client.close();
    process.exit(1);
  }
}

await client.close();
