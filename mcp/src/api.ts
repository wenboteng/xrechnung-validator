import { readFile, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { basename } from "node:path";

export const API_URL = "https://checkxrechnung.com/v1/validate";
export const RULE_BASE = "https://checkxrechnung.com/fehler/";
export const WAITLIST_URL = "https://checkxrechnung.com/api-waitlist";
export const MAX_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "xrechnung-validator-mcp/0.1.0 (+https://checkxrechnung.com)";

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RuleError {
  rule_id?: string;
  severity?: string;
  location?: string;
  message?: string;
  hint?: string;
  rule_url?: string;
}

export interface ValidationResult {
  valid: boolean;
  fileName?: string;
  bytes?: number;
  hasXml?: boolean;
  syntax?: string;
  invoiceType?: string;
  persisted?: boolean;
  summary?: { errors?: number; warnings?: number };
  versions?: Record<string, string>;
  errors: RuleError[];
}

interface Issue {
  severity?: unknown;
  code?: unknown;
  rule_id?: unknown;
  ruleId?: unknown;
  location?: unknown;
  message?: unknown;
  hint?: unknown;
  rule_url?: unknown;
  ruleUrl?: unknown;
}

function contentTypeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xml") || lower.endsWith(".cii")) return "application/xml";
  return "application/octet-stream";
}

export function ruleUrl(issue: Issue): string | undefined {
  for (const value of [issue.rule_url, issue.ruleUrl]) {
    if (typeof value === "string" && value.trim()) return value;
  }
  const code = issue.code || issue.rule_id || issue.ruleId;
  if (typeof code !== "string" || !code.trim()) return undefined;
  return RULE_BASE + code.trim().toLowerCase();
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function normalize(report: Record<string, unknown>): ValidationResult {
  const issues = Array.isArray(report.issues) ? report.issues : [];
  const errors: RuleError[] = [];
  for (const raw of issues) {
    if (!raw || typeof raw !== "object") continue;
    const issue = raw as Issue;
    const code = issue.code || issue.rule_id || issue.ruleId;
    const item: RuleError = {};
    if (typeof code === "string" && code) item.rule_id = code;
    const severity = asString(issue.severity);
    const location = asString(issue.location);
    const message = asString(issue.message);
    const hint = asString(issue.hint);
    const url = ruleUrl(issue);
    if (severity) item.severity = severity;
    if (location) item.location = location;
    if (message) item.message = message;
    if (hint) item.hint = hint;
    if (url) item.rule_url = url;
    errors.push(item);
  }
  const result: ValidationResult = { valid: report.ok === true, errors };
  const fileName = asString(report.fileName);
  if (fileName) result.fileName = fileName;
  if (typeof report.bytes === "number" && Number.isInteger(report.bytes)) result.bytes = report.bytes;
  if (typeof report.hasXml === "boolean") result.hasXml = report.hasXml;
  const syntax = asString(report.syntax);
  if (syntax) result.syntax = syntax;
  const invoiceType = asString(report.invoiceType);
  if (invoiceType) result.invoiceType = invoiceType;
  if (typeof report.persisted === "boolean") result.persisted = report.persisted;
  if (report.summary && typeof report.summary === "object") {
    const summary = report.summary as { errors?: unknown; warnings?: unknown };
    const out: { errors?: number; warnings?: number } = {};
    if (typeof summary.errors === "number") out.errors = summary.errors;
    if (typeof summary.warnings === "number") out.warnings = summary.warnings;
    result.summary = out;
  }
  if (report.versions && typeof report.versions === "object") {
    const versions: Record<string, string> = {};
    for (const [key, value] of Object.entries(report.versions as Record<string, unknown>)) {
      if (typeof value === "string") versions[key] = value;
    }
    if (Object.keys(versions).length) result.versions = versions;
  }
  return result;
}

function encodeMultipart(filename: string, bytes: Buffer, contentType: string): { body: Buffer; contentType: string } {
  const safeName = filename.replace(/[\r\n"]/g, "");
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

export async function validatePath(filePath: string): Promise<ValidationResult> {
  let info;
  try {
    info = await stat(filePath);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "ENOENT") throw new ApiError(`file not found: ${filePath}`);
    throw new ApiError(`cannot read file: ${filePath}`);
  }
  if (!info.isFile()) throw new ApiError(`file not found: ${filePath}`);
  if (info.size === 0) throw new ApiError(`empty file: ${filePath}`);
  if (info.size > MAX_BYTES) throw new ApiError(`file is larger than 5 MB, the API limit: ${filePath}`);
  const bytes = await readFile(filePath);
  const name = basename(filePath) || "invoice.xml";
  return validateBytes(name, bytes, contentTypeFor(name));
}

export async function validateXml(xml: string): Promise<ValidationResult> {
  const bytes = Buffer.from(xml, "utf8");
  return validateBytes("invoice.xml", bytes, "application/xml");
}

export async function validateBytes(filename: string, bytes: Buffer, contentType: string): Promise<ValidationResult> {
  if (bytes.length === 0) throw new ApiError("empty file");
  if (bytes.length > MAX_BYTES) throw new ApiError("file is larger than 5 MB, the API limit");
  const form = encodeMultipart(filename, bytes, contentType);
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        "Content-Type": form.contentType,
      },
      body: form.body,
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    throw new ApiError(`network error: ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = await response.text();
  if (response.status !== 200) throw new ApiError(httpError(response, text));
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ApiError("API returned a non-JSON response");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError("API returned an unexpected JSON response");
  }
  return normalize(payload as Record<string, unknown>);
}

function httpError(response: Response, text: string): string {
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
