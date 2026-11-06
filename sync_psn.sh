#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "🎮 [1/2] Синхронизация PS5 активности для Cr1mnsx через PlayStation API..."
node scripts/sync_psn.mjs || echo "⚠️ Ошибка синхронизации PSN, продолжаем..."

echo ""
echo "⭐ [2/2] Синхронизация профиля Brawl Stars (#2RGUQJQ0R)..."
node scripts/sync_brawl.mjs || echo "⚠️ Ошибка синхронизации Brawl Stars, продолжаем..."

echo ""
echo "📦 Проверка обновлений данных..."
git add data/psn_recent.json data/psn_games.json assets/data/psn_games.json data/brawl.json assets/data/brawl.json 2>/dev/null || true

if git diff --staged --quiet; then
  echo "✅ Изменений в игровых данных нет. Данные уже самые свежие."
else
  git commit -m "chore(sync): автообновление статуса PS5 и Brawl Stars"
  echo "🚀 Отправка обновления на GitHub..."
  git pull --rebase origin main || true
  git push origin main
  echo ""
  echo "🎉 Готово! Сайт https://crimnsx-alt.github.io/cr1mnsx/ успешно обновлен!"
fi
