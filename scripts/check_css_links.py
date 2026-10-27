#!/usr/bin/env python3
"""Check local CSS links and @import paths without external dependencies.

Run from the repository root:
    python3 scripts/check_css_links.py
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
CSS_LINK = re.compile(
    r'<link\b(?=[^>]*\brel\s*=\s*["\']stylesheet["\'])'
    r'[^>]*\bhref\s*=\s*["\']([^"\']+)["\'][^>]*>',
    re.IGNORECASE,
)
CSS_IMPORT = re.compile(
    r'@import\s+(?:url\(\s*)?["\']([^"\']+)["\']\s*\)?\s*;',
    re.IGNORECASE,
)


def local_target(source: Path, url: str) -> Path | None:
    """Return a local path, ignoring remote and in-page URLs."""
    if url.startswith(("http:", "https:", "//", "data:", "#")):
        return None
    clean = url.split("?", 1)[0].split("#", 1)[0]
    if not clean:
        return None
    return (ROOT / clean.lstrip("/")) if url.startswith("/") else (source.parent / clean)


def main() -> int:
    errors = []
    checks = 0

    for page in ROOT.glob("*.html"):
        for href in CSS_LINK.findall(page.read_text(encoding="utf-8")):
            target = local_target(page, href)
            if target is not None:
                checks += 1
                if not target.is_file():
                    errors.append(f"{page.name}: missing stylesheet {href}")

    for css in ROOT.rglob("*.css"):
        for href in CSS_IMPORT.findall(css.read_text(encoding="utf-8")):
            target = local_target(css, href)
            if target is not None:
                checks += 1
                if not target.is_file():
                    errors.append(f"{css.relative_to(ROOT)}: missing import {href}")

    for error in errors:
        print("ERROR:", error)

    print(f"Checked {checks} local CSS references across HTML and CSS files.")
    if errors:
        print(f"Found {len(errors)} missing file(s).")
        return 1

    print("All referenced local CSS files exist.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
