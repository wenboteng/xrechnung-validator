"""Call the public checkxrechnung.com validator API."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

API_URL = "https://checkxrechnung.com/v1/validate"
RULE_BASE = "https://checkxrechnung.com/fehler/"
WAITLIST_URL = "https://checkxrechnung.com/api-waitlist"
MAX_BYTES = 5 * 1024 * 1024
USER_AGENT = "xrechnung-check/0.1.0 (+https://checkxrechnung.com)"
TIMEOUT = (10, 120)


class ClientError(Exception):
    """Usage, network, or HTTP failure. The CLI exits 2."""


def content_type_for(name: str) -> str:
    lower = name.lower()
    if lower.endswith(".pdf"):
        return "application/pdf"
    if lower.endswith(".xml") or lower.endswith(".cii"):
        return "application/xml"
    return "application/octet-stream"


def rule_url(issue: dict[str, Any]) -> str | None:
    for key in ("rule_url", "ruleUrl"):
        value = issue.get(key)
        if isinstance(value, str) and value.strip():
            return value
    code = issue.get("code") or issue.get("rule_id") or issue.get("ruleId")
    if not isinstance(code, str) or not code.strip():
        return None
    return RULE_BASE + code.strip().lower()


def _clean(data: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if value is not None and value != ""}


def normalize(report: dict[str, Any]) -> dict[str, Any]:
    """Turn an API report into the CLI JSON shape.

    ``rule_url`` is taken from the issue when the API sends it. Otherwise it
    is the public rule page ``https://checkxrechnung.com/fehler/<code>``.
    """
    issues = report.get("issues")
    errors: list[dict[str, Any]] = []
    if isinstance(issues, list):
        for issue in issues:
            if not isinstance(issue, dict):
                continue
            code = issue.get("code") or issue.get("rule_id") or issue.get("ruleId")
            errors.append(
                _clean(
                    {
                        "rule_id": code if isinstance(code, str) else None,
                        "severity": issue.get("severity") if isinstance(issue.get("severity"), str) else None,
                        "location": issue.get("location") if isinstance(issue.get("location"), str) else None,
                        "message": issue.get("message") if isinstance(issue.get("message"), str) else None,
                        "hint": issue.get("hint") if isinstance(issue.get("hint"), str) else None,
                        "rule_url": rule_url(issue),
                    }
                )
            )
    summary = None
    summary_in = report.get("summary")
    if isinstance(summary_in, dict):
        summary = {}
        if isinstance(summary_in.get("errors"), int):
            summary["errors"] = summary_in["errors"]
        if isinstance(summary_in.get("warnings"), int):
            summary["warnings"] = summary_in["warnings"]
    result: dict[str, Any] = {"valid": report.get("ok") is True, "errors": errors}
    if isinstance(report.get("fileName"), str):
        result["fileName"] = report["fileName"]
    if isinstance(report.get("bytes"), int):
        result["bytes"] = report["bytes"]
    if isinstance(report.get("hasXml"), bool):
        result["hasXml"] = report["hasXml"]
    if isinstance(report.get("syntax"), str):
        result["syntax"] = report["syntax"]
    if isinstance(report.get("invoiceType"), str):
        result["invoiceType"] = report["invoiceType"]
    if isinstance(report.get("persisted"), bool):
        result["persisted"] = report["persisted"]
    if summary is not None:
        result["summary"] = summary
    versions = report.get("versions")
    if isinstance(versions, dict):
        clean_versions = {str(key): value for key, value in versions.items() if isinstance(value, str)}
        if clean_versions:
            result["versions"] = clean_versions
    order = (
        "valid",
        "fileName",
        "bytes",
        "hasXml",
        "syntax",
        "invoiceType",
        "persisted",
        "summary",
        "versions",
        "errors",
    )
    return {key: result[key] for key in order if key in result}


def format_report(result: dict[str, Any]) -> str:
    lines: list[str] = []
    status = "valid" if result.get("valid") else "invalid"
    lines.append(f"{status}: {result.get('fileName') or ''}".rstrip())
    if result.get("syntax"):
        lines.append(f"syntax: {result['syntax']}")
    if result.get("invoiceType"):
        lines.append(f"type: {result['invoiceType']}")
    if isinstance(result.get("hasXml"), bool):
        lines.append("xml: yes" if result["hasXml"] else "xml: no")
    summary = result.get("summary") or {}
    if isinstance(summary, dict):
        if "errors" in summary:
            lines.append(f"errors: {summary['errors']}")
        if "warnings" in summary:
            lines.append(f"warnings: {summary['warnings']}")
    for issue in result.get("errors") or []:
        lines.append("")
        bits = [str(issue.get("rule_id") or "(no rule id)"), str(issue.get("severity") or "issue")]
        if issue.get("location"):
            bits.append(str(issue["location"]))
        lines.append(" ".join(bits))
        if issue.get("message"):
            lines.append(f"  message: {issue['message']}")
        if issue.get("hint"):
            lines.append(f"  hint: {issue['hint']}")
        if issue.get("rule_url"):
            lines.append(f"  rule_url: {issue['rule_url']}")
    return "\n".join(lines) + "\n"


def dumps(result: dict[str, Any]) -> str:
    return json.dumps(result, ensure_ascii=False, indent=2) + "\n"


def validate_path(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ClientError(f"file not found: {path}")
    size = path.stat().st_size
    if size == 0:
        raise ClientError(f"empty file: {path}")
    if size > MAX_BYTES:
        raise ClientError(f"file is larger than 5 MB, the API limit: {path}")
    return validate_bytes(path.name, path.read_bytes(), content_type_for(path.name))


def validate_bytes(filename: str, data: bytes, content_type: str) -> dict[str, Any]:
    if not data:
        raise ClientError("empty file")
    if len(data) > MAX_BYTES:
        raise ClientError("file is larger than 5 MB, the API limit")
    import requests

    try:
        response = requests.post(
            API_URL,
            files={"file": (filename, data, content_type)},
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=TIMEOUT,
        )
    except requests.RequestException as exc:
        raise ClientError(f"network error: {exc}") from exc
    if response.status_code != 200:
        raise ClientError(_http_error(response))
    try:
        payload = response.json()
    except ValueError as exc:
        raise ClientError("API returned a non-JSON response") from exc
    if not isinstance(payload, dict):
        raise ClientError("API returned an unexpected JSON response")
    return normalize(payload)


def _http_error(response: Any) -> str:
    retry = response.headers.get("Retry-After")
    body = (response.text or "").strip().replace("\n", " ")
    if len(body) > 500:
        body = body[:500] + "…"
    if response.status_code == 429:
        wait = f" Retry-After: {retry}s." if retry else ""
        return (
            f"rate limit reached (HTTP 429).{wait} "
            f"Free limit: 50 per IP per UTC day, 10 per minute. Waitlist: {WAITLIST_URL}. {body}"
        ).strip()
    if response.status_code == 413:
        return f"file too large (HTTP 413). The API accepts at most 5 MB. {body}".strip()
    extra = f" Retry-After: {retry}s." if retry else ""
    return f"HTTP {response.status_code}.{extra} {body}".strip()
