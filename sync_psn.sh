#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "🎮 Синхронизация PS5 активности для Cr1mnsx..."
python3 .github/scripts/fetch_psn.py

echo "📦 Проверка изменений..."
git add data/psn_recent.json data/psn_games.json assets/data/psn_games.json 2>/dev/null || true

if git diff --staged --quiet; then
  echo "✅ Изменений в играх нет. Данные актуальны."
else
  git commit -m "feat(psn): обновить статус запущенных игр на PS5"
  echo "🚀 Отправка обновления на GitHub..."
  git push origin main
  echo "🎉 Готово! Сайт https://crimnsx-alt.github.io/cr1mnsx/ обновится в течение 1 минуты."
fi
