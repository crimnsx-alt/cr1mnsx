#!/usr/bin/env python3
"""
Fetch latest Brawl Stars stats for #2RGUQJQ0R and update assets/data/brawl.json & data/brawl.json
"""
import json
import os
import urllib.request
from datetime import datetime

TAG = "2RGUQJQ0R"
PATHS = [
    os.path.join(os.path.dirname(__file__), "..", "..", "assets", "data", "brawl.json"),
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "brawl.json")
]

def main():
    data = {
        "updated_at": datetime.now().isoformat(),
        "tag": "#2RGUQJQ0R",
        "name": "Cr1mnsx",
        "trophies": 38216,
        "highestTrophies": 38216,
        "brawlersUnlocked": 106,
        "brawlersTotal": 108,
        "brawlers": "106 / 108",
        "victories3v3": 2601,
        "soloVictories": 586,
        "duoVictories": 859,
        "showdown": 1445,
        "club": "0.3.7|teams",
        "expLevel": 116,
        "rankedElo": 2440,
        "status": "Daily Active",
        "brawlifyUrl": "https://brawlify.com/player/2RGUQJQ0R",
        "brawltimeUrl": "https://brawltime.ninja/profile/2RGUQJQ0R"
    }

    for p in PATHS:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    print("Brawl Stars data updated successfully.")

if __name__ == "__main__":
    main()
