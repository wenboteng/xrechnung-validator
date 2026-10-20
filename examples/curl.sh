#!/usr/bin/env bash
# Upload one XRechnung XML (UBL or CII) or ZUGFeRD PDF.
# This calls the live API and uses one free validation.
#
# UBL sample:
#   ./examples/curl.sh samples/valid-xrechnung-ubl.xml
# CII (same request; point it at your CrossIndustryInvoice XML):
#   ./examples/curl.sh invoice-cii.xml
# ZUGFeRD / Factur-X (separate routes, 10 MB, same free counter):
#   curl -F "file=@samples/factur-x-en16931.pdf" https://checkxrechnung.com/v1/zugferd/validate
#   curl -F "file=@samples/factur-x-en16931.pdf" https://checkxrechnung.com/v1/zugferd/extract
set -euo pipefail
if [[ $# -ne 1 ]]; then
  echo "usage: curl.sh FILE" >&2
  echo "UBL: curl -F file=@samples/valid-xrechnung-ubl.xml https://checkxrechnung.com/v1/validate" >&2
  echo "CII: curl -F file=@invoice-cii.xml https://checkxrechnung.com/v1/validate" >&2
  exit 2
fi
curl -sS -F "file=@$1" "https://checkxrechnung.com/v1/validate"
echo
