#!/usr/bin/env python3
"""Validate one file with requests. Python 3.9+. Uses one free API call."""

import sys

import requests

if len(sys.argv) != 2:
    sys.stderr.write("usage: python python_requests.py FILE\n")
    sys.exit(2)

path = sys.argv[1]
with open(path, "rb") as handle:
    response = requests.post(
        "https://checkxrechnung.com/v1/validate",
        files={"file": handle},
        timeout=120,
    )
response.raise_for_status()
print(response.text)
sys.exit(0 if response.json().get("ok") is True else 1)
