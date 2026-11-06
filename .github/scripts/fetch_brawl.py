#!/usr/bin/env python3
"""
Fetch latest Brawl Stars stats for #2RGUQJQ0R and update assets/data/brawl.json & data/brawl.json.
Delegates to scripts/sync_brawl.mjs when Node.js is available.
"""
import os
import subprocess
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SYNC_SCRIPT = os.path.join(ROOT_DIR, "scripts", "sync_brawl.mjs")

def main():
    if os.path.exists(SYNC_SCRIPT):
        res = subprocess.run(["node", SYNC_SCRIPT], cwd=ROOT_DIR)
        sys.exit(res.returncode)
    else:
        print("sync_brawl.mjs not found", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
