#!/usr/bin/env node
import { dumps, extractPath, formatExtract, formatReport, validatePath, zugferdPath, ClientError } from "../lib/api.js";

const USAGE = `usage: xrechnung-check FILE [--json]
       xrechnung-check zugferd FILE [--json]
       xrechnung-check extract FILE [--json]

xrechnung-check FILE
  Validate one XRechnung XML file (UBL or CII) or ZUGFeRD PDF with
  https://checkxrechnung.com/v1/validate
  Limits: 50 requests per IP per UTC day, 10 per minute, 5 MB.

xrechnung-check zugferd FILE
  Validate one ZUGFeRD / Factur-X PDF with
  https://checkxrechnung.com/v1/zugferd/validate
  Same free limit (shared counter). PDF limit: 10 MB.

xrechnung-check extract FILE
  Extract the embedded XML and a JSON summary from
  https://checkxrechnung.com/v1/zugferd/extract

No API key. The file is uploaded for that request. The service reports
persisted: false.

  --json    print the normalized report as JSON on stdout

Exit codes:
  0  the file is valid, or extract found an XML
  1  the file is invalid, it is not an e-invoice, or extract found no XML
  2  usage error, unreadable file, or the API could not be reached
`;

function fail(message, asJson) {
  if (asJson) process.stdout.write(dumps({ valid: false, ok: false, error: message }));
  else process.stderr.write(message + "\n");
  process.exit(2);
}

const argv = process.argv.slice(2);
let mode = "validate";
if (argv[0] === "zugferd" || argv[0] === "extract") {
  mode = argv.shift();
}
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
  const result =
    mode === "zugferd" ? await zugferdPath(files[0]) : mode === "extract" ? await extractPath(files[0]) : await validatePath(files[0]);
  if (mode === "extract") {
    process.stdout.write(asJson ? dumps(result) : formatExtract(result));
    process.exit(result.ok ? 0 : 1);
  }
  process.stdout.write(asJson ? dumps(result) : formatReport(result));
  process.exit(result.valid ? 0 : 1);
} catch (err) {
  if (err instanceof ClientError) fail(err.message, asJson);
  fail(err instanceof Error ? err.message : String(err), asJson);
}
