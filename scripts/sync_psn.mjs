#!/usr/bin/env node

/**
 * Official PlayStation Network Sync for Cr1mnsx
 * Directly queries Sony PlayStation Network API for real-time PS5 presence, trophy summary, play duration, and games.
 */

import {
  exchangeNpssoForCode,
  exchangeCodeForAccessToken,
  getBasicPresence,
  getUserPlayedGames,
  getRecentlyPlayedGames,
  getUserTitles,
  getUserTrophyProfileSummary
} from "psn-api";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
  return minutes > 0 ? `${minutes} мин.` : "";
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
    console.error("❌ Ошибка: NPSSO токен не найден в psn_config.json или переменной окружения PSN_NPSSO!");
    console.error("💡 Получите 64-символьный токен на https://ca.account.sony.com/api/v1/ssocookie");
    process.exit(1);
  }

  let auth;
  try {
    const accessCode = await exchangeNpssoForCode(npsso);
    auth = await exchangeCodeForAccessToken(accessCode);
  } catch (err) {
    console.error("❌ Срок действия токена PSN_NPSSO истёк или токен недействителен:", err.message);
    console.error("💡 Обновите токен в psn_config.json или GitHub Secrets (PSN_NPSSO).");
    process.exit(1);
  }

  // Decode JWT for Account ID
  const jwtPayload = JSON.parse(Buffer.from(auth.accessToken.split(".")[1], "base64").toString());
  const accountId = jwtPayload.account_id;
  console.log(`✅ Авторизован в PSN! ID аккаунта: ${accountId}`);

  // 1. Fetch live presence
  let isOnline = false;
  let isPlayingNow = false;
  let currentActiveGame = null;
  let lastAvailableDate = null;

  try {
    const presenceRes = await getBasicPresence(auth, "me");
    const bp = presenceRes?.basicPresence;
    lastAvailableDate = bp?.lastAvailableDate || null;
    if (bp?.primaryPlatformInfo?.onlineStatus === "online" || bp?.availability === "availableToPlay") {
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

  // 1.5 Fetch overall account trophy summary
  let accountTrophySummary = {
    trophyLevel: 199,
    progress: 45,
    tier: 3,
    earnedTrophies: { bronze: 555, silver: 120, gold: 32, platinum: 2 },
    totalTrophies: 709
  };

  try {
    const summaryRes = await getUserTrophyProfileSummary(auth, accountId);
    if (summaryRes && summaryRes.trophyLevel) {
      const et = summaryRes.earnedTrophies || { bronze: 0, silver: 0, gold: 0, platinum: 0 };
      const total = (et.bronze || 0) + (et.silver || 0) + (et.gold || 0) + (et.platinum || 0);
      accountTrophySummary = {
        trophyLevel: Number(summaryRes.trophyLevel) || 199,
        progress: Number(summaryRes.progress) || 0,
        tier: Number(summaryRes.tier) || 3,
        earnedTrophies: et,
        totalTrophies: total || 709
      };
      console.log(`🏅 Уровень PSN: ${accountTrophySummary.trophyLevel} · Всего трофеев: ${accountTrophySummary.totalTrophies} (Платин: ${et.platinum})`);
    }
  } catch (e) {
    console.warn("⚠️ getUserTrophyProfileSummary error:", e.message);
  }

  // 2. Fetch played games with exact playDuration and category
  let recentlyPlayed = [];
  try {
    const playedRes = await getUserPlayedGames(auth, accountId, { limit: 18 });
    recentlyPlayed = playedRes?.titles || [];
  } catch (e) {
    console.warn("⚠️ getUserPlayedGames error:", e.message);
  }

  if (recentlyPlayed.length === 0) {
    try {
      const recRes = await getRecentlyPlayedGames(auth, { limit: 16 });
      recentlyPlayed = recRes?.data?.gameLibraryTitlesRetrieve?.games || [];
    } catch (e) {
      console.warn("⚠️ getRecentlyPlayedGames error:", e.message);
    }
  }

  // 3. Fetch trophies for progress (up to 150 titles for thorough matching)
  let trophyTitles = [];
  try {
    const trophyRes = await getUserTitles(auth, accountId, { limit: 150 });
    trophyTitles = trophyRes?.trophyTitles || [];
  } catch (e) {
    console.warn("⚠️ getUserTitles error:", e.message);
  }

  function normalizeName(str) {
    return (str || "")
      .toLowerCase()
      .replace(/\(playstation®?5\)|\(ps5\)|\(ps4\)/gi, "")
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

  // Map trophy titles by normalized name
  const trophyMap = new Map();
  for (const t of trophyTitles) {
    const norm = normalizeName(t.trophyTitleName);
    if (!trophyMap.has(norm) || (t.progress > (trophyMap.get(norm).progress || 0))) {
      trophyMap.set(norm, t);
    }
  }

  function findTrophies(name) {
    const clean = normalizeName(name);
    if (trophyMap.has(clean)) return trophyMap.get(clean);
    for (const [key, val] of trophyMap.entries()) {
      if (clean.includes(key) || key.includes(clean)) return val;
    }
    return null;
  }

  // Build deduplicated games array
  const gamesList = [];
  const seenNormalized = new Set();

  for (const g of recentlyPlayed) {
    const titleName = g.localizedName || g.name;
    const normKey = normalizeName(titleName);
    if (seenNormalized.has(normKey)) continue;
    seenNormalized.add(normKey);

    const trophies = findTrophies(titleName);

    let thumbUrl = g.localizedImageUrl || g.imageUrl || g.image?.url || "";
    let bannerUrl = thumbUrl;

    const mediaImages = g.media?.images || g.concept?.media?.images || [];
    if (mediaImages.length > 0) {
      const coverTypes = ["GAMEHUB_COVER_ART", "FOUR_BY_THREE_BANNER", "MASTER", "PORTRAIT_BANNER"];
      for (const ct of coverTypes) {
        const found = mediaImages.find(img => img.type === ct);
        if (found) {
          bannerUrl = found.url;
          break;
        }
      }
      if (!thumbUrl) {
        const master = mediaImages.find(img => img.type === "MASTER") || mediaImages[0];
        if (master) thumbUrl = master.url;
      }
    }
    if (!thumbUrl && trophies?.trophyTitleIconUrl) {
      thumbUrl = trophies.trophyTitleIconUrl;
      bannerUrl = bannerUrl || thumbUrl;
    }

    const duration = formatDuration(g.playDuration);
    const lastPlayedText = formatDateRu(g.lastPlayedDateTime);
    const progress = trophies ? trophies.progress : 0;
    const earned = trophies
      ? (trophies.earnedTrophies.bronze + trophies.earnedTrophies.silver + trophies.earnedTrophies.gold + trophies.earnedTrophies.platinum)
      : 0;
    const total = trophies
      ? (trophies.definedTrophies.bronze + trophies.definedTrophies.silver + trophies.definedTrophies.gold + trophies.definedTrophies.platinum)
      : 0;

    const isPs5 = g.category === "ps5_native_game" || (trophies?.trophyTitlePlatform || "").includes("PS5") || /playstation®?5/i.test(titleName);

    gamesList.push({
      id: normKey.replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-|-$/g, ""),
      title: titleName.replace(/\s*\(PlayStation®?5\)/i, ""),
      subtitle: duration ? `Сыграно на PS5: ${duration}` : `PlayStation 5`,
      platform: isPs5 ? "PS5" : "PS4",
      played_on: "PS5",
      play_count: g.playCount || 1,
      progress_pct: progress,
      trophies_earned: earned,
      trophies_total: total,
      trophy_breakdown: trophies ? trophies.earnedTrophies : { bronze: 0, silver: 0, gold: 0, platinum: 0 },
      rank: calculateRank(progress),
      last_played: lastPlayedText,
      last_played_iso: g.lastPlayedDateTime,
      play_duration: duration,
      status: (isPlayingNow && currentActiveGame && normalizeName(currentActiveGame).includes(normKey))
        ? "🟢 Играет прямо сейчас"
        : (progress >= 100 ? "Пройдено на 100%" : (progress >= 30 ? "Сюжет пройден" : "Активно на PS5")),
      banner: bannerUrl || thumbUrl,
      thumb: thumbUrl || bannerUrl,
      note: `Запущено на консоли PlayStation 5${duration ? ` · Наиграно: ${duration}` : ""}${g.playCount ? ` (${g.playCount} запусков)` : ""}.`,
      link: `https://psnprofiles.com/Cr1mnsx`
    });
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
    last_available_date: lastAvailableDate,
    account_summary: accountTrophySummary,
    game: {
      title: primaryGame.title,
      platform: primaryGame.platform,
      played_on: "PS5",
      image: primaryGame.thumb,
      banner: primaryGame.banner,
      play_count: primaryGame.play_count,
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
    },
    recent_history: gamesList.slice(0, 8).map(g => ({
      title: g.title,
      platform: g.platform,
      image: g.thumb,
      banner: g.banner,
      progress_percent: g.progress_pct,
      trophies_earned: g.trophies_earned,
      trophies_total: g.trophies_total,
      rank: g.rank,
      last_played: g.last_played,
      play_duration: g.play_duration,
      play_count: g.play_count
    }))
  };

  // Write files
  fs.mkdirSync(path.dirname(RECENT_JSON_PATH), { recursive: true });
  fs.writeFileSync(RECENT_JSON_PATH, JSON.stringify(recentPayload, null, 2), "utf8");
  fs.writeFileSync(GAMES_JSON_PATH, JSON.stringify(gamesList, null, 2), "utf8");

  if (fs.existsSync(path.dirname(ASSETS_GAMES_JSON_PATH))) {
    fs.writeFileSync(ASSETS_GAMES_JSON_PATH, JSON.stringify(gamesList, null, 2), "utf8");
  }

  console.log(`\n🎉 УСПЕШНО СИНХРОНИЗИРОВАНО С PLAYSTATION 5:`);
  console.log(`🏆 Последняя игра: ${primaryGame.title} [${primaryGame.platform}] (${primaryGame.progress_pct}% трофеев, ${primaryGame.trophies_earned}/${primaryGame.trophies_total})`);
  console.log(`⏱️ Время в игре: ${primaryGame.play_duration || "не указано"} (${primaryGame.play_count} запусков)`);
  console.log(`📅 Дата: ${recentPayload.game.last_played_text}`);
  console.log(`📚 Всего уникальных игр обновлено в библиотеке: ${gamesList.length}`);
}

main().catch(err => {
  console.error("❌ Ошибка выполнения:", err);
  process.exit(1);
});
