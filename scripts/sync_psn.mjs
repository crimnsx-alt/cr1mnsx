#!/usr/bin/env node

/**
 * Official PlayStation Network Sync for Cr1mnsx
 * Directly queries Sony PlayStation Network API for real-time PS5 presence and games.
 */

import {
  exchangeNpssoForCode,
  exchangeCodeForAccessToken,
  getBasicPresence,
  getRecentlyPlayedGames,
  getUserTitles,
  getProfileFromAccountId
} from "psn-api";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const CONFIG_PATH = path.join(ROOT, "psn_config.json");
const RECENT_JSON_PATH = path.join(ROOT, "data", "psn_recent.json");
const GAMES_JSON_PATH = path.join(ROOT, "data", "psn_games.json");
const ASSETS_GAMES_JSON_PATH = path.join(ROOT, "assets", "data", "psn_games.json");

function loadNpsso() {
  if (process.env.PSN_NPSSO) return process.env.PSN_NPSSO.trim();
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
      if (cfg.npsso) return cfg.npsso.trim();
    } catch {}
  }
  return null;
}

function formatDuration(iso) {
  if (!iso) return "";
  let hours = 0;
  let minutes = 0;
  const hMatch = iso.match(/(\d+)H/);
  const mMatch = iso.match(/(\d+)M/);
  if (hMatch) hours = parseInt(hMatch[1], 10);
  if (mMatch) minutes = parseInt(mMatch[1], 10);
  if (hours > 0) {
    return minutes > 0 ? `${hours} ч. ${minutes} мин.` : `${hours} ч.`;
  }
  return `${minutes} мин.`;
}

function formatDateRu(isoStr) {
  if (!isoStr) return "";
  try {
    const dt = new Date(isoStr);
    const months = [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря"
    ];
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  } catch {
    return isoStr;
  }
}

function calculateRank(pct) {
  if (pct >= 100) return "S";
  if (pct >= 75) return "A";
  if (pct >= 50) return "B";
  if (pct >= 25) return "C";
  if (pct >= 10) return "D";
  return "E";
}

async function main() {
  console.log("🎮 Подключение к PlayStation Network...");
  const npsso = loadNpsso();
  if (!npsso) {
    console.error("❌ Ошибка: NPSSO токен не найден в psn_config.json или PSN_NPSSO!");
    process.exit(1);
  }

  const accessCode = await exchangeNpssoForCode(npsso);
  const auth = await exchangeCodeForAccessToken(accessCode);

  // Decode JWT for Account ID
  const jwtPayload = JSON.parse(Buffer.from(auth.accessToken.split(".")[1], "base64").toString());
  const accountId = jwtPayload.account_id;
  console.log(`✅ Авторизован в PSN! ID аккаунта: ${accountId}`);

  // 1. Fetch live presence
  let isOnline = false;
  let isPlayingNow = false;
  let currentActiveGame = null;

  try {
    const presenceRes = await getBasicPresence(auth, "me");
    const bp = presenceRes?.basicPresence;
    if (bp?.primaryPlatformInfo?.onlineStatus === "online") {
      isOnline = true;
      if (bp.gameTitleInfoList && bp.gameTitleInfoList.length > 0) {
        isPlayingNow = true;
        currentActiveGame = bp.gameTitleInfoList[0].titleName;
      }
    }
  } catch (e) {
    console.warn("⚠️ Не удалось получить presence статус:", e.message);
  }

  console.log(`📡 Статус сети: ${isOnline ? "В СЕТИ (ONLINE)" : "НЕ В СЕТИ (OFFLINE)"}`);
  if (isPlayingNow) {
    console.log(`🔥 В ИГРЕ СЕЙЧАС: ${currentActiveGame}`);
  }

  // 2. Fetch recently played games
  let recentlyPlayed = [];
  try {
    const recRes = await getRecentlyPlayedGames(auth, { limit: 12 });
    recentlyPlayed = recRes?.data?.gameLibraryTitlesRetrieve?.games || [];
  } catch (e) {
    console.warn("⚠️ getRecentlyPlayedGames error:", e.message);
  }

  // 3. Fetch trophies for progress
  let trophyTitles = [];
  try {
    const trophyRes = await getUserTitles(auth, accountId, { limit: 20 });
    trophyTitles = trophyRes?.trophyTitles || [];
  } catch (e) {
    console.warn("⚠️ getUserTitles error:", e.message);
  }

  function normalizeName(str) {
    return str
      .toLowerCase()
      .replace(/™|®|©/g, "")
      .replace(/[:\-–—]/g, " ")
      .replace(/ⅰ/g, "i")
      .replace(/ⅱ/g, "ii")
      .replace(/ⅲ/g, "iii")
      .replace(/ⅳ/g, "iv")
      .replace(/ⅴ/g, "v")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Map trophy titles by name for quick lookup
  const trophyMap = new Map();
  for (const t of trophyTitles) {
    trophyMap.set(normalizeName(t.trophyTitleName), t);
  }

  // Helper to find matching trophies
  function findTrophies(name) {
    const clean = normalizeName(name);
    if (trophyMap.has(clean)) return trophyMap.get(clean);
    for (const [key, val] of trophyMap.entries()) {
      if (clean.includes(key) || key.includes(clean)) return val;
    }
    return null;
  }

  // Build games array
  const gamesList = [];
  for (const g of recentlyPlayed) {
    const titleName = g.name;
    const trophies = findTrophies(titleName);

    // Get best high-res cover art
    let coverUrl = "";
    if (g.media?.images) {
      const coverTypes = ["GAMEHUB_COVER_ART", "MASTER", "FOUR_BY_THREE_BANNER", "PORTRAIT_BANNER"];
      for (const ct of coverTypes) {
        const found = g.media.images.find(img => img.type === ct);
        if (found) {
          coverUrl = found.url;
          break;
        }
      }
      if (!coverUrl && g.media.images[0]) coverUrl = g.media.images[0].url;
    }
    if (!coverUrl && trophies?.trophyTitleIconUrl) {
      coverUrl = trophies.trophyTitleIconUrl;
    }

    const duration = formatDuration(g.playDuration);
    const lastPlayedText = formatDateRu(g.lastPlayedDateTime);
    const progress = trophies ? trophies.progress : 0;
    const earned = trophies ? (trophies.earnedTrophies.bronze + trophies.earnedTrophies.silver + trophies.earnedTrophies.gold + trophies.earnedTrophies.platinum) : 0;
    const total = trophies ? (trophies.definedTrophies.bronze + trophies.definedTrophies.silver + trophies.definedTrophies.gold + trophies.definedTrophies.platinum) : 0;

    gamesList.push({
      id: titleName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title: titleName,
      subtitle: duration ? `Сыграно на PS5: ${duration}` : `PlayStation 5`,
      platform: g.category === "ps5_native_game" ? "PS5" : "PS4",
      played_on: "PS5",
      progress_pct: progress,
      trophies_earned: earned,
      trophies_total: total,
      trophy_breakdown: trophies ? trophies.earnedTrophies : { bronze: 0, silver: 0, gold: 0, platinum: 0 },
      rank: calculateRank(progress),
      last_played: lastPlayedText,
      last_played_iso: g.lastPlayedDateTime,
      play_duration: duration,
      status: (isPlayingNow && currentActiveGame && currentActiveGame.toLowerCase().includes(titleName.toLowerCase())) 
        ? "🟢 Играет прямо сейчас" 
        : (progress >= 100 ? "Пройдено на 100%" : (progress >= 30 ? "Сюжет пройден" : "В процессе прохождения")),
      banner: coverUrl,
      thumb: coverUrl,
      note: `Запущено на консоли PlayStation 5. Общее время в игре: ${duration || "несколько часов"}. Прогресс трофеев: ${progress}%.`,
      link: `https://psnprofiles.com/Cr1mnsx`
    });
  }

  // Fallback to trophyTitles if recentlyPlayed was empty
  if (gamesList.length === 0 && trophyTitles.length > 0) {
    for (const t of trophyTitles) {
      const progress = t.progress || 0;
      const earned = (t.earnedTrophies.bronze + t.earnedTrophies.silver + t.earnedTrophies.gold + t.earnedTrophies.platinum);
      const total = (t.definedTrophies.bronze + t.definedTrophies.silver + t.definedTrophies.gold + t.definedTrophies.platinum);
      gamesList.push({
        id: t.trophyTitleName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        title: t.trophyTitleName,
        subtitle: `PlayStation Network · ${progress}%`,
        platform: t.trophyTitlePlatform || "PS5",
        played_on: "PS5",
        progress_pct: progress,
        trophies_earned: earned,
        trophies_total: total,
        trophy_breakdown: t.earnedTrophies,
        rank: calculateRank(progress),
        last_played: formatDateRu(t.lastUpdatedDateTime),
        last_played_iso: t.lastUpdatedDateTime,
        status: progress >= 100 ? "Платина получена" : "В процессе",
        banner: t.trophyTitleIconUrl,
        thumb: t.trophyTitleIconUrl,
        link: `https://psnprofiles.com/Cr1mnsx`
      });
    }
  }

  if (gamesList.length === 0) {
    console.log("Нет данных об играх для записи.");
    return;
  }

  // 4. Form recent game widget payload
  const primaryGame = gamesList[0];
  const recentPayload = {
    updated_at: new Date().toISOString(),
    username: "Cr1mnsx",
    psn_url: "https://psn.gg/profile/Cr1mnsx",
    is_online: isOnline,
    is_playing_now: isPlayingNow,
    game: {
      title: primaryGame.title,
      platform: primaryGame.platform,
      played_on: "PS5",
      image: primaryGame.thumb,
      progress_percent: primaryGame.progress_pct,
      trophies_earned: primaryGame.trophies_earned,
      trophies_total: primaryGame.trophies_total,
      rank: primaryGame.rank,
      bronze: primaryGame.trophy_breakdown.bronze,
      silver: primaryGame.trophy_breakdown.silver,
      gold: primaryGame.trophy_breakdown.gold,
      platinum: primaryGame.trophy_breakdown.platinum,
      last_played_text: isPlayingNow ? "🟢 В игре прямо сейчас!" : primaryGame.last_played,
      play_duration: primaryGame.play_duration
    }
  };

  // Write files
  fs.mkdirSync(path.dirname(RECENT_JSON_PATH), { recursive: true });
  fs.writeFileSync(RECENT_JSON_PATH, JSON.stringify(recentPayload, null, 2), "utf8");
  fs.writeFileSync(GAMES_JSON_PATH, JSON.stringify(gamesList, null, 2), "utf8");

  if (fs.existsSync(path.dirname(ASSETS_GAMES_JSON_PATH))) {
    fs.writeFileSync(ASSETS_GAMES_JSON_PATH, JSON.stringify(gamesList, null, 2), "utf8");
  }

  console.log(`\n🎉 УСПЕШНО СИНХРОНИЗИРОВАНО С PLAYSTATION 5:`);
  console.log(`🏆 Последняя игра: ${primaryGame.title} (${primaryGame.progress_pct}% трофеев)`);
  console.log(`⏱️ Время в игре: ${primaryGame.play_duration || "не указано"}`);
  console.log(`📅 Дата: ${recentPayload.game.last_played_text}`);
  console.log(`📚 Всего игр обновлено в библиотеке: ${gamesList.length}`);
}

main().catch(err => {
  console.error("❌ Ошибка выполнения:", err);
  process.exit(1);
});
