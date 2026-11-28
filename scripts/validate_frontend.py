#!/usr/bin/env python3
"""Small dependency-free smoke checks for the SyncTube web shell."""
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class IdAudit(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.seen: set[str] = set()
        self.duplicates: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            if element_id in self.seen:
                self.duplicates.add(element_id)
            self.seen.add(element_id)

def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)

html_path = ROOT / "index.html"
css_path = ROOT / "styles.css"
js_path = ROOT / "app.js"
manifest_path = ROOT / "manifest.webmanifest"
sw_path = ROOT / "sw.js"

for path in (html_path, css_path, js_path, manifest_path, sw_path):
    if not path.is_file():
        fail(f"required file is missing: {path.relative_to(ROOT)}")

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")
sw = sw_path.read_text(encoding="utf-8")

parser = IdAudit()
parser.feed(html)
parser.close()
if parser.duplicates:
    fail("duplicate HTML id attributes: " + ", ".join(sorted(parser.duplicates)))

critical_ids = {
    "authGate",
    "appShell",
    "authForm",
    "themeToggleBtn",
    "offlineBanner",
    "offlineRetryBtn",
    "playlistInput",
    "playlistForm",
}
missing = critical_ids - parser.seen
if missing:
    fail("critical HTML controls are missing: " + ", ".join(sorted(missing)))

# Catch statically referenced ID selectors that no longer exist in index.html.
referenced_ids = set(re.findall(r'\$\("#([A-Za-z][A-Za-z0-9_-]*)"\)', js))
missing_references = referenced_ids - parser.seen
if missing_references:
    fail("app.js refers to missing HTML IDs: " + ", ".join(sorted(missing_references)))

try:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
except json.JSONDecodeError as exc:
    fail(f"manifest.webmanifest is not valid JSON: {exc}")

if manifest.get("short_name") != "SyncTube":
    fail("manifest short_name must remain SyncTube")
if manifest.get("display") not in {"standalone", "fullscreen", "minimal-ui"}:
    fail("manifest must retain an installable app display mode")

if "@media (prefers-reduced-motion: reduce)" not in css:
    fail("CSS reduced-motion support is missing")
if "synctube-shell-v5" not in sw:
    fail("service-worker cache name was not bumped with the current shell")
if "synctube:v1:settings" not in js:
    fail("versioned theme-preference storage key is missing")

print("SyncTube frontend smoke checks passed.")
print(f"Checked {len(parser.seen)} unique HTML IDs and {len(referenced_ids)} static app.js ID references.")
