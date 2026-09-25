#!/usr/bin/env python3
"""Rewrite the import list in src/data/real-scenarios/index.ts to match the
real-*.json files present (the /review page removes rejected ones itself)."""

import re
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent / "src" / "data" / "real-scenarios"
INDEX = DIR / "index.ts"


def var(name: str) -> str:
    return re.sub(r"-(\w)", lambda m: m.group(1).upper(), name)


def main() -> int:
    names = sorted(p.stem for p in DIR.glob("real-*.json"))
    src = INDEX.read_text()
    src = re.sub(r'^import \w+ from "\./real-[\w-]+\.json";\n', "", src, flags=re.M)
    src = re.sub(r"const registered: unknown\[\] = \[[^\]]*\];",
                 "const registered: unknown[] = [\n" + "".join(f"  {var(n)},\n" for n in names) + "];", src)
    imports = "".join(f'import {var(n)} from "./{n}.json";\n' for n in names)
    src = src.replace("\nconst registered", "\n" + imports + "\nconst registered", 1)
    src = re.sub(r"\n{3,}", "\n\n", src)
    INDEX.write_text(src)
    print(f"Registered {len(names)} scenario file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
