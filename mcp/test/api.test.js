import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../dist/api.js";

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
