"""Argument parsing and process exit codes for xrechnung-check."""

from __future__ import annotations

import sys
from pathlib import Path

from xrechnung_check.client import (
    ClientError,
    dumps,
    extract_path,
    format_extract,
    format_report,
    validate_path,
    zugferd_path,
)

USAGE = """\
usage: xrechnung-check FILE [--json]
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
"""


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]
    mode = "validate"
    if argv and argv[0] in {"zugferd", "extract"}:
        mode = argv[0]
        argv = argv[1:]
    as_json = False
    files: list[str] = []
    for arg in argv:
        if arg in ("-h", "--help"):
            sys.stdout.write(USAGE)
            return 0
        if arg == "--json":
            as_json = True
            continue
        if arg.startswith("-"):
            sys.stderr.write(f"unknown option: {arg}\n{USAGE}")
            return 2
        files.append(arg)
    if len(files) != 1:
        sys.stderr.write(USAGE)
        return 2
    try:
        if mode == "zugferd":
            result = zugferd_path(Path(files[0]))
        elif mode == "extract":
            result = extract_path(Path(files[0]))
        else:
            result = validate_path(Path(files[0]))
    except ClientError as exc:
        if as_json:
            sys.stdout.write(dumps({"valid": False, "ok": False, "error": str(exc)}))
        else:
            sys.stderr.write(f"{exc}\n")
        return 2
    if mode == "extract":
        sys.stdout.write(dumps(result) if as_json else format_extract(result))
        return 0 if result.get("ok") else 1
    sys.stdout.write(dumps(result) if as_json else format_report(result))
    return 0 if result["valid"] else 1
