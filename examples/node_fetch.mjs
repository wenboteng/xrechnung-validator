#!/usr/bin/env node
// Node 18+. Validate one file with fetch. Uses one free API call.
//   node examples/node_fetch.mjs samples/valid-xrechnung-ubl.xml
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("usage: node node_fetch.mjs FILE");
  process.exit(2);
}

const bytes = await readFile(file);
const type = file.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/xml";
const form = new FormData();
form.append("file", new Blob([bytes], { type }), basename(file));

const response = await fetch("https://checkxrechnung.com/v1/validate", {
  method: "POST",
  body: form,
  headers: { Accept: "application/json" },
});
const body = await response.text();
process.stdout.write(body.endsWith("\n") ? body : body + "\n");
if (!response.ok) process.exit(1);
const report = JSON.parse(body);
process.exit(report.ok === true ? 0 : 1);
