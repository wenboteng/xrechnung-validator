#!/usr/bin/env node
import { dumps, formatReport, validatePath, ClientError } from "../lib/api.js";

const USAGE = `usage: xrechnung-check FILE [--json]

Validate one XRechnung XML file (UBL or CII) or ZUGFeRD PDF with the free
API at https://checkxrechnung.com/v1/validate

No API key. Limits: 50 requests per IP per UTC day, 10 per minute, 5 MB.
The file is uploaded for that request. The service reports persisted: false.

  --json    print the normalized report as JSON on stdout

Exit codes:
  0  the file is valid
  1  the file is invalid, or it is not an e-invoice
  2  usage error, unreadable file, or the API could not be reached
`;

function fail(message, asJson) {
  if (asJson) process.stdout.write(dumps({ valid: false, error: message }));
  else process.stderr.write(message + "\n");
  process.exit(2);
}

const argv = process.argv.slice(2);
let asJson = false;
const files = [];
for (const arg of argv) {
  if (arg === "-h" || arg === "--help") {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  if (arg === "--json") {
    asJson = true;
    continue;
  }
  if (arg.startsWith("-")) {
    process.stderr.write(`unknown option: ${arg}\n${USAGE}`);
    process.exit(2);
  }
  files.push(arg);
}
if (files.length !== 1) {
  process.stderr.write(USAGE);
  process.exit(2);
}

try {
  const result = await validatePath(files[0]);
  process.stdout.write(asJson ? dumps(result) : formatReport(result));
  process.exit(result.valid ? 0 : 1);
} catch (err) {
  if (err instanceof ClientError) fail(err.message, asJson);
  fail(err instanceof Error ? err.message : String(err), asJson);
}
