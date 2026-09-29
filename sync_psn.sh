#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "🎮 Синхронизация PS5 активности для Cr1mnsx через официальный PlayStation API..."
node scripts/sync_psn.mjs

echo ""
echo "📦 Проверка обновлений данных..."
git add data/psn_recent.json data/psn_games.json assets/data/psn_games.json 2>/dev/null || true

if git diff --staged --quiet; then
  echo "✅ Изменений в играх нет. Данные уже самые свежие."
else
  git commit -m "feat(psn): обновить статус запущенных игр на PS5"
  echo "🚀 Отправка обновления на GitHub..."
  git push origin main
  echo ""
  echo "🎉 Готово! Сайт https://crimnsx-alt.github.io/cr1mnsx/ успешно обновлен!"
fi
