import assert from "node:assert/strict";
import test from "node:test";
import { API_PRO_URL, rateLimitMessage } from "../lib/api.js";

test("429 from an older server still links to API Pro", () => {
  const out = rateLimitMessage('{"error":"rate_limit","message":"Free limit: old text.","waitlist":"https://checkxrechnung.com/api-waitlist"}', "42");
  assert.match(out, /^rate limit reached \(HTTP 429\)\. Retry-After: 42s\./);
  assert.ok(out.includes("Free limit: old text."));
  assert.ok(out.includes("API Pro"));
  assert.ok(out.includes(API_PRO_URL));
  assert.ok(API_PRO_URL.includes("utm_source=cli"));
  assert.ok(API_PRO_URL.includes("utm_medium=429"));
});

test("429 with upgrade_url uses the server link and tags the client", () => {
  const out = rateLimitMessage('{"error":"rate_limit","message":"Free limit reached. Get an API Pro key: https://checkxrechnung.com/en/docs?utm_source=api&utm_medium=429&utm_campaign=api_pro#pricing","upgrade_url":"https://checkxrechnung.com/en/docs?utm_source=api&utm_medium=429&utm_campaign=api_pro#pricing"}', null);
  assert.ok(out.includes("https://checkxrechnung.com/"));
  assert.ok(out.includes("ref=cli"));
  assert.ok(out.includes("utm_source=api"));
  assert.equal(out.split("https://").length - 1, 1);
});

test("429 with a non-JSON body falls back to the default text", () => {
  const out = rateLimitMessage("<html>busy</html>", null);
  assert.ok(out.includes("Free limit:"));
  assert.ok(out.includes(API_PRO_URL));
});
