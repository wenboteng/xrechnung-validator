import { readFile, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";

export const API_URL = "https://checkxrechnung.com/v1/validate";
export const RULE_BASE = "https://checkxrechnung.com/fehler/";
export const WAITLIST_URL = "https://checkxrechnung.com/api-waitlist";
export const MAX_BYTES = 5 * 1024 * 1024;
export const USER_AGENT = "xrechnung-check/0.1.0 (+https://checkxrechnung.com)";

export class ClientError extends Error {
  constructor(message) {
    super(message);
    this.name = "ClientError";
  }
}

export function contentTypeFor(name) {
  const lower = String(name).toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xml") || lower.endsWith(".cii")) return "application/xml";
  return "application/octet-stream";
}

export function ruleUrl(issue) {
  if (!issue || typeof issue !== "object") return undefined;
  for (const key of ["rule_url", "ruleUrl"]) {
    const value = issue[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  const code = issue.code || issue.rule_id || issue.ruleId;
  if (typeof code !== "string" || !code.trim()) return undefined;
  return RULE_BASE + code.trim().toLowerCase();
}

function clean(data) {
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  }
  return out;
}

export function normalize(report) {
  const issues = Array.isArray(report.issues) ? report.issues : [];
  const errors = [];
  for (const issue of issues) {
    if (!issue || typeof issue !== "object") continue;
    const code = issue.code || issue.rule_id || issue.ruleId;
    errors.push(
      clean({
        rule_id: typeof code === "string" ? code : undefined,
        severity: typeof issue.severity === "string" ? issue.severity : undefined,
        location: typeof issue.location === "string" ? issue.location : undefined,
        message: typeof issue.message === "string" ? issue.message : undefined,
        hint: typeof issue.hint === "string" ? issue.hint : undefined,
        rule_url: ruleUrl(issue),
      }),
    );
  }
  const result = { valid: report.ok === true, errors };
  if (typeof report.fileName === "string") result.fileName = report.fileName;
  if (Number.isInteger(report.bytes)) result.bytes = report.bytes;
  if (typeof report.hasXml === "boolean") result.hasXml = report.hasXml;
  if (typeof report.syntax === "string") result.syntax = report.syntax;
  if (typeof report.invoiceType === "string") result.invoiceType = report.invoiceType;
  if (typeof report.persisted === "boolean") result.persisted = report.persisted;
  if (report.summary && typeof report.summary === "object") {
    const summary = {};
    if (Number.isInteger(report.summary.errors)) summary.errors = report.summary.errors;
    if (Number.isInteger(report.summary.warnings)) summary.warnings = report.summary.warnings;
    result.summary = summary;
  }
  if (report.versions && typeof report.versions === "object") {
    const versions = {};
    for (const [key, value] of Object.entries(report.versions)) {
      if (typeof value === "string") versions[key] = value;
    }
    if (Object.keys(versions).length) result.versions = versions;
  }
  return result;
}

export function formatReport(result) {
  const lines = [];
  const status = result.valid ? "valid" : "invalid";
  lines.push(`${status}: ${result.fileName || ""}`.trimEnd());
  if (result.syntax) lines.push(`syntax: ${result.syntax}`);
  if (result.invoiceType) lines.push(`type: ${result.invoiceType}`);
  if (typeof result.hasXml === "boolean") lines.push(result.hasXml ? "xml: yes" : "xml: no");
  const summary = result.summary || {};
  if (summary.errors != null) lines.push(`errors: ${summary.errors}`);
  if (summary.warnings != null) lines.push(`warnings: ${summary.warnings}`);
  for (const issue of result.errors || []) {
    lines.push("");
    const bits = [issue.rule_id || "(no rule id)", issue.severity || "issue"];
    if (issue.location) bits.push(issue.location);
    lines.push(bits.join(" "));
    if (issue.message) lines.push(`  message: ${issue.message}`);
    if (issue.hint) lines.push(`  hint: ${issue.hint}`);
    if (issue.rule_url) lines.push(`  rule_url: ${issue.rule_url}`);
  }
  return lines.join("\n") + "\n";
}

export function dumps(result) {
  return JSON.stringify(result, null, 2) + "\n";
}

function encodeMultipart(filename, bytes, contentType) {
  const safeName = String(filename).replace(/[\r\n"]/g, "");
  const boundary = "----xrechnung" + randomBytes(12).toString("hex");
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${safeName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return {
    body: Buffer.concat([head, bytes, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export async function validatePath(filePath) {
  let info;
  try {
    info = await stat(filePath);
  } catch (err) {
    if (err && err.code === "ENOENT") throw new ClientError(`file not found: ${filePath}`);
    throw new ClientError(`cannot read file: ${filePath}`);
  }
  if (!info.isFile()) throw new ClientError(`file not found: ${filePath}`);
  if (info.size === 0) throw new ClientError(`empty file: ${filePath}`);
  if (info.size > MAX_BYTES) throw new ClientError(`file is larger than 5 MB, the API limit: ${filePath}`);
  const bytes = await readFile(filePath);
  const name = filePath.split(/[\\/]/).pop() || "invoice.xml";
  return validateBytes(name, bytes, contentTypeFor(name));
}

export async function validateBytes(filename, bytes, contentType) {
  if (!bytes || bytes.length === 0) throw new ClientError("empty file");
  if (bytes.length > MAX_BYTES) throw new ClientError("file is larger than 5 MB, the API limit");
  const form = encodeMultipart(filename, bytes, contentType);
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        "Content-Type": form.contentType,
      },
      body: form.body,
      signal: AbortSignal.timeout(120000),
    });
  } catch (err) {
    throw new ClientError(`network error: ${err instanceof Error ? err.message : err}`);
  }
  const text = await response.text();
  if (response.status !== 200) throw new ClientError(httpError(response, text));
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ClientError("API returned a non-JSON response");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ClientError("API returned an unexpected JSON response");
  }
  return normalize(payload);
}

function httpError(response, text) {
  const retry = response.headers.get("retry-after");
  let body = (text || "").trim().replace(/\s+/g, " ");
  if (body.length > 500) body = body.slice(0, 500) + "…";
  if (response.status === 429) {
    const wait = retry ? ` Retry-After: ${retry}s.` : "";
    return `rate limit reached (HTTP 429).${wait} Free limit: 50 per IP per UTC day, 10 per minute. Waitlist: ${WAITLIST_URL}. ${body}`.trim();
  }
  if (response.status === 413) {
    return `file too large (HTTP 413). The API accepts at most 5 MB. ${body}`.trim();
  }
  const extra = retry ? ` Retry-After: ${retry}s.` : "";
  return `HTTP ${response.status}.${extra} ${body}`.trim();
}
