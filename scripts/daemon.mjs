#!/usr/bin/env node

/**
 * PSN Auto-Sync Daemon
 * Automatically checks PS5 activity every 60 minutes and pushes updates to GitHub.
 */

import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SYNC_SCRIPT = path.join(ROOT, "sync_psn.sh");

const INTERVAL_MINUTES = 60;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;

function runSync() {
  const timestamp = new Date().toLocaleTimeString("ru-RU");
  console.log(`[${timestamp}] 🔄 Запуск плановой синхронизации PS5...`);
  
  exec(`bash "${SYNC_SCRIPT}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`[${timestamp}] ❌ Ошибка синхронизации:`, error.message);
      return;
    }
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
    console.log(`[${timestamp}] ⏳ Следующая проверка через ${INTERVAL_MINUTES} минут.`);
  });
}

console.log("🎮 Запущен фоновый демон синхронизации PlayStation 5 для Cr1mnsx");
console.log(`⏰ Интервал автообновления: каждые ${INTERVAL_MINUTES} минут.`);
console.log("----------------------------------------------------------------");

// Запускаем сразу при старте
runSync();

// И затем каждый час
setInterval(runSync, INTERVAL_MS);
