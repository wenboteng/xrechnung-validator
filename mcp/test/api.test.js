import assert from "node:assert/strict";
import test from "node:test";
import { normalize, normalizeExtract } from "../dist/api.js";

test("normalize keeps rule ids and derives rule_url", () => {
  const result = normalize({
    ok: false,
    fileName: "invalid-xrechnung-ubl.xml",
    hasXml: true,
    syntax: "UBL Invoice",
    summary: { errors: 1, warnings: 0 },
    issues: [
      {
        severity: "error",
        code: "BR-08",
        location: "/Invoice",
        message: "Seller postal address is missing.",
      },
    ],
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].rule_id, "BR-08");
  assert.equal(result.errors[0].rule_url, "https://checkxrechnung.com/fehler/br-08");
});

test("an API rule_url wins over the derived page", () => {
  const result = normalize({
    ok: true,
    issues: [{ code: "BR-DE-15", rule_url: "https://checkxrechnung.com/fehler/custom" }],
  });
  assert.equal(result.valid, true);
  assert.equal(result.errors[0].rule_url, "https://checkxrechnung.com/fehler/custom");
});

test("zugferd normalize keeps profile and extract keeps xml", () => {
  const validated = normalize({
    ok: true,
    profile: "XRECHNUNG",
    embeddedName: "xrechnung.xml",
    pdfa: { engine: "structure", label: "PDF/A-3 structure check (not veraPDF)", ok: true },
    issues: [],
  });
  assert.equal(validated.profile, "XRECHNUNG");
  assert.equal(validated.pdfa.engine, "structure");
  const extracted = normalizeExtract({
    ok: true,
    profile: "EN16931",
    summary: { invoiceNumber: "RX-2026-001" },
    xml: "<invoice/>",
  });
  assert.equal(extracted.ok, true);
  assert.equal(extracted.summary.invoiceNumber, "RX-2026-001");
  assert.equal(extracted.xml, "<invoice/>");
});
