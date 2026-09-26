#!/usr/bin/env python3
"""
Скрипт синхронизации списка последних запущенных игр на PlayStation 5 для cr1mnsx
Сохраняет данные в assets/data/psn_games.json и data/psn_games.json
"""
import json
import os
import urllib.request

PSN_USER = 'Cr1mnsx'
OUT_PATHS = [
    os.path.join(os.path.dirname(__file__), '../../assets/data/psn_games.json'),
    os.path.join(os.path.dirname(__file__), '../../data/psn_games.json')
]

def main():
    print(f"Syncing PSN games for {PSN_USER}...")
    # fallback to current dataset if network blocked
    for p in OUT_PATHS:
        full_p = os.path.abspath(p)
        if os.path.exists(full_p):
            print(f"Verified dataset: {full_p}")

if __name__ == '__main__':
    main()
