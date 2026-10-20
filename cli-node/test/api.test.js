import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { formatReport, normalize } from "../lib/api.js";

const bin = fileURLToPath(new URL("../bin/xrechnung-check.js", import.meta.url));

test("derives a rule page when the API omits rule_url", () => {
  const result = normalize({
    ok: false,
    fileName: "invoice.xml",
    hasXml: true,
    summary: { errors: 1, warnings: 0 },
    issues: [{ severity: "error", code: "BR-DE-15", message: "Buyer reference is missing." }],
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].rule_id, "BR-DE-15");
  assert.equal(result.errors[0].rule_url, "https://checkxrechnung.com/fehler/br-de-15");
  assert.match(formatReport(result), /rule_url: https:\/\/checkxrechnung.com\/fehler\/br-de-15/);
});

test("keeps rule_url when the API sends it", () => {
  const result = normalize({
    ok: true,
    issues: [{ code: "BR-08", rule_url: "https://checkxrechnung.com/fehler/br-08", severity: "warning" }],
  });
  assert.equal(result.valid, true);
  assert.equal(result.errors[0].rule_url, "https://checkxrechnung.com/fehler/br-08");
});

test("help and a missing file do not need the network", () => {
  const help = spawnSync(process.execPath, [bin, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /checkxrechnung.com\/v1\/validate/);
  assert.match(help.stdout, /zugferd/);

  const zugferd = spawnSync(process.execPath, [bin, "extract", "no-such.pdf"], { encoding: "utf8" });
  assert.equal(zugferd.status, 2);
  assert.match(zugferd.stderr, /file not found/);

  const missing = spawnSync(process.execPath, [bin, "no-such-invoice.xml"], { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /file not found/);

  const dir = mkdtempSync(join(tmpdir(), "xrechnung-check-"));
  const empty = join(dir, "empty.xml");
  writeFileSync(empty, "");
  const emptyRun = spawnSync(process.execPath, [bin, empty], { encoding: "utf8" });
  assert.equal(emptyRun.status, 2);
  assert.match(emptyRun.stderr, /empty file/);
});
