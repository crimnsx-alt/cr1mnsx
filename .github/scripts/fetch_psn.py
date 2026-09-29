#!/usr/bin/env python3
"""
PSN Live & Recent Games Synchronizer for Cr1mnsx
Fetches real-time PlayStation 5 presence and recently launched games directly from Sony PlayStation Network API.
Updates data/psn_recent.json and data/psn_games.json.
Can run locally or automatically in GitHub Actions.
"""

import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime

USER = "Cr1mnsx"
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CONFIG_PATH = os.path.join(REPO_ROOT, "psn_config.json")
DATA_RECENT_PATH = os.path.join(REPO_ROOT, "data", "psn_recent.json")
DATA_GAMES_PATH = os.path.join(REPO_ROOT, "data", "psn_games.json")

CLIENT_ID = "09515139-7237-4370-a403-380e29e081aa"
REDIRECT_URI = "com.scee.psxmobile.scecompcall://redirect"
BASIC_AUTH = "Basic MDk1MTUxMzktNzIzNy00MzcwLWE0MDMtMzgwZTI5ZTA4MWFhOnA2UXJFcDJrRURlQ2hpblE="


def get_npsso():
    """Retrieve NPSSO from environment variable or psn_config.json."""
    if os.environ.get("PSN_NPSSO"):
        return os.environ.get("PSN_NPSSO").strip()
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                if cfg.get("npsso"):
                    return cfg["npsso"].strip()
        except Exception:
            pass
    return None


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def authenticate_npsso(npsso):
    """Exchange 64-char NPSSO token for PlayStation access token."""
    print("Authenticating with PlayStation Network...")
    auth_url = (
        f"https://ca.account.sony.com/api/authz/v3/oauth/authorize?"
        f"access_type=offline&client_id={CLIENT_ID}&response_type=code&"
        f"scope=psn:mobile.core&redirect_uri={urllib.parse.quote(REDIRECT_URI)}"
    )

    req = urllib.request.Request(
        auth_url,
        headers={
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
            "Cookie": f"npsso={npsso}",
        },
    )

    opener = urllib.request.build_opener(NoRedirectHandler)
    code = None
    try:
        opener.open(req)
    except urllib.error.HTTPError as e:
        location = e.headers.get("Location")
        if location and "code=" in location:
            match = re.search(r"code=([A-Za-z0-9_\-\.]+)", location)
            if match:
                code = match.group(1)

    if not code:
        raise ValueError(
            "Failed to obtain auth code from Sony. Your NPSSO token may have expired or is invalid.\n"
            "To renew it: Log in to playstation.com, then open https://ca.account.sony.com/api/v1/ssocookie"
        )

    # Exchange code for tokens
    token_url = "https://ca.account.sony.com/api/authz/v3/oauth/token"
    token_data = urllib.parse.urlencode({
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": REDIRECT_URI,
        "scope": "psn:mobile.core",
        "token_format": "jwt",
    }).encode("utf-8")

    token_req = urllib.request.Request(
        token_url,
        data=token_data,
        headers={
            "Authorization": BASIC_AUTH,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0",
        },
    )

    with urllib.request.urlopen(token_req) as resp:
        tokens = json.loads(resp.read().decode("utf-8"))

    print("Successfully authenticated with Sony PSN!")
    return tokens["access_token"]


def fetch_psn_presence(access_token):
    """Check if PS5 is online right now and what game is running."""
    try:
        url = "https://m.np.playstation.com/api/userProfile/v1/internal/users/me/basicPresences?type=primary"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "User-Agent": "Mozilla/5.0",
            },
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("basicPresence", {})
    except Exception as e:
        print(f"Warning: could not fetch presence: {e}")
        return {}


def fetch_psn_titles(access_token, limit=12):
    """Fetch list of recently played games on PlayStation."""
    url = f"https://m.np.playstation.com/api/gamelist/v2/users/me/titles?limit={limit}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data.get("titles", [])


def format_duration(iso_duration):
    """Convert ISO duration like PT42H15M into human readable text."""
    if not iso_duration:
        return ""
    hours = 0
    minutes = 0
    h_m = re.search(r"(\d+)H", iso_duration)
    if h_m:
        hours = int(h_m.group(1))
    m_m = re.search(r"(\d+)M", iso_duration)
    if m_m:
        minutes = int(m_m.group(1))
    if hours > 0:
        return f"{hours} ч. {minutes} мин." if minutes > 0 else f"{hours} ч."
    return f"{minutes} мин."


def format_date_ru(iso_str):
    """Format ISO timestamp to Russian date string."""
    if not iso_str:
        return ""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        months = [
            "", "января", "февраля", "марта", "апреля", "мая", "июня",
            "июля", "августа", "сентября", "октября", "ноября", "декабря"
        ]
        return f"{dt.day} {months[dt.month]} {dt.year}"
    except Exception:
        return iso_str


def sync():
    npsso = get_npsso()
    if not npsso:
        print("=" * 60)
        print("PSN_NPSSO token is not configured.")
        print("To enable automatic live PS5 syncing:")
        print("1. Log in to your account on playstation.com in a browser.")
        print("2. Open this link in the same browser: https://ca.account.sony.com/api/v1/ssocookie")
        print("3. Copy your 64-character token.")
        print("4. Add it to psn_config.json as:")
        print('   {\n     "npsso": "YOUR_64_CHAR_TOKEN_HERE"\n   }')
        print("   OR export PSN_NPSSO='YOUR_TOKEN'")
        print("=" * 60)
        print("Using current cached PS5 data.")
        return

    try:
        token = authenticate_npsso(npsso)
    except Exception as e:
        print(f"Auth error: {e}")
        return

    presence = fetch_psn_presence(token)
    titles = fetch_psn_titles(token, limit=12)

    if not titles:
        print("No titles returned from PSN.")
        return

    # Check live presence
    is_online = presence.get("primaryPlatformInfo", {}).get("onlineStatus") == "online"
    active_game_info = presence.get("gameTitleInfoList", [{}])[0] if presence.get("gameTitleInfoList") else None

    print(f"PlayStation Network status: {'ONLINE' if is_online else 'OFFLINE'}")
    if is_online and active_game_info:
        print(f"Currently playing: {active_game_info.get('titleName', 'Unknown')}")

    # Determine latest game
    latest_title = titles[0]
    title_name = latest_title.get("name", "Unknown Game")
    title_img = latest_title.get("image", {}).get("url", "")
    format_cat = latest_title.get("format", "PS5")
    last_played_raw = latest_title.get("lastPlayedDateTime", "")
    duration_str = format_duration(latest_title.get("playDuration", ""))

    last_played_text = "Играет прямо сейчас!" if (is_online and active_game_info) else format_date_ru(last_played_raw)

    # 1. Update data/psn_recent.json
    recent_payload = {
        "updated_at": datetime.now().isoformat(),
        "username": USER,
        "psn_url": f"https://psn.gg/profile/{USER}",
        "is_online": is_online,
        "is_playing_now": bool(is_online and active_game_info),
        "game": {
            "title": title_name,
            "platform": format_cat,
            "played_on": "PS5",
            "image": title_img,
            "play_duration": duration_str,
            "last_played_text": last_played_text,
            "last_played_iso": last_played_raw,
            "progress_percent": 25
        }
    }

    # Preserve trophies if already recorded
    if os.path.exists(DATA_RECENT_PATH):
        try:
            with open(DATA_RECENT_PATH, "r", encoding="utf-8") as f:
                old = json.load(f)
                if old.get("game", {}).get("title") == title_name:
                    for k in ["progress_percent", "trophies_earned", "trophies_total", "bronze", "silver", "gold", "platinum", "last_trophy"]:
                        if k in old["game"]:
                            recent_payload["game"][k] = old["game"][k]
        except Exception:
            pass

    os.makedirs(os.path.dirname(DATA_RECENT_PATH), exist_ok=True)
    with open(DATA_RECENT_PATH, "w", encoding="utf-8") as f:
        json.dump(recent_payload, f, ensure_ascii=False, indent=2)

    print(f"Updated data/psn_recent.json -> {title_name} ({last_played_text})")

    # 2. Update data/psn_games.json
    games_list = []
    # Load existing custom notes if any
    existing_notes = {}
    if os.path.exists(DATA_GAMES_PATH):
        try:
            with open(DATA_GAMES_PATH, "r", encoding="utf-8") as f:
                old_list = json.load(f)
                for item in old_list:
                    if item.get("title"):
                        existing_notes[item["title"]] = item
        except Exception:
            pass

    for t in titles:
        t_name = t.get("name", "")
        if not t_name:
            continue
        cached = existing_notes.get(t_name, {})
        duration = format_duration(t.get("playDuration", ""))

        game_entry = {
            "id": cached.get("id") or re.sub(r"[^a-z0-9]+", "-", t_name.lower()).strip("-"),
            "title": t_name,
            "subtitle": cached.get("subtitle", f"Сыграно на PS5: {duration}" if duration else "Запущено на PlayStation 5"),
            "platform": t.get("format", "PS5"),
            "played_on": "PS5",
            "progress_pct": cached.get("progress_pct", 0),
            "trophies_earned": cached.get("trophies_earned", 0),
            "trophies_total": cached.get("trophies_total", 0),
            "trophy_breakdown": cached.get("trophy_breakdown", {"platinum": 0, "gold": 0, "silver": 0, "bronze": 0}),
            "rank": cached.get("rank", "C"),
            "last_played": format_date_ru(t.get("lastPlayedDateTime", "")),
            "play_duration": duration,
            "status": "Активная игра" if t == titles[0] else cached.get("status", "В библиотеке"),
            "banner": t.get("image", {}).get("url") or cached.get("banner", ""),
            "thumb": t.get("image", {}).get("url") or cached.get("thumb", ""),
            "note": cached.get("note", f"Запущено на консоли PlayStation 5. Общее время в игре: {duration}."),
            "link": cached.get("link", f"https://psnprofiles.com/Cr1mnsx")
        }
        games_list.append(game_entry)

    with open(DATA_GAMES_PATH, "w", encoding="utf-8") as f:
        json.dump(games_list, f, ensure_ascii=False, indent=2)

    print(f"Updated data/psn_games.json with {len(games_list)} games from your PS5!")


if __name__ == "__main__":
    sync()
