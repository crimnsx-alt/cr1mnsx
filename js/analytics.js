/**
 * cr1mnsx — Privacy-First Visitor Analytics & Telemetry Engine
 * Базовый отсчёт: от 346 визитов, уникальных посетителей ~295
 * Полная конфиденциальность: личные данные, IP и геолокация пользователя не собираются
 */
(function() {
  'use strict';

  const STORAGE_KEYS = {
    UID: 'cr1mnsx_uid_v2',
    TOTAL_VISITS: 'cr1mnsx_total_visits_v2',
    UNIQUE_VISITORS: 'cr1mnsx_unique_visitors_v2',
    TODAY_VISITS: 'cr1mnsx_today_visits_v2',
    TODAY_DATE: 'cr1mnsx_today_date_v2'
  };

  // Очистка устаревших ключей первой версии
  try {
    ['cr1mnsx_total_visits', 'cr1mnsx_unique_visitors', 'cr1mnsx_recent_visitors', 'cr1mnsx_today_visits', 'cr1mnsx_today_date'].forEach(k => {
      localStorage.removeItem(k);
    });
  } catch {}

  // Базовые начальные счётчики по запросу пользователя: от 346 входов, уникальных ~295
  const BASE_TOTAL = 346;
  const BASE_UNIQUE = 295;

  // Обновление локальных счётчиков
  function updateCounters() {
    let uid = null;
    let isNewVisitor = false;
    try {
      uid = localStorage.getItem(STORAGE_KEYS.UID);
      if (!uid) {
        uid = 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        localStorage.setItem(STORAGE_KEYS.UID, uid);
        isNewVisitor = true;
      }
    } catch {}

    // Всего входов на сайт (начинаем от 346)
    let total = BASE_TOTAL;
    try {
      const savedTotal = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_VISITS) || '0', 10);
      if (savedTotal && savedTotal >= BASE_TOTAL) {
        total = savedTotal;
      }
      total += 1;
      localStorage.setItem(STORAGE_KEYS.TOTAL_VISITS, total);
    } catch {}

    // Уникальных гостей (начинаем от 295)
    let unique = BASE_UNIQUE;
    try {
      const savedUnique = parseInt(localStorage.getItem(STORAGE_KEYS.UNIQUE_VISITORS) || '0', 10);
      if (savedUnique && savedUnique >= BASE_UNIQUE) {
        unique = savedUnique;
      }
      if (isNewVisitor) {
        unique += 1;
        localStorage.setItem(STORAGE_KEYS.UNIQUE_VISITORS, unique);
      }
    } catch {}

    // Сегодня
    const todayStr = new Date().toISOString().slice(0, 10);
    let todayCount = 14;
    try {
      const lastDate = localStorage.getItem(STORAGE_KEYS.TODAY_DATE);
      const savedToday = parseInt(localStorage.getItem(STORAGE_KEYS.TODAY_VISITS) || '0', 10);
      if (lastDate === todayStr && savedToday) {
        todayCount = savedToday + 1;
      } else {
        todayCount = 14;
        localStorage.setItem(STORAGE_KEYS.TODAY_DATE, todayStr);
      }
      localStorage.setItem(STORAGE_KEYS.TODAY_VISITS, todayCount);
    } catch {}

    return { total, unique, today: todayCount };
  }

  // Обновление показателей в DOM
  function renderKPIs(counters) {
    const fmt = n => Number(n).toLocaleString('ru-RU');

    // Плашка в шапке
    const topVisits = document.getElementById('topbarVisitsCount');
    if (topVisits) topVisits.textContent = fmt(counters.total);

    // В разделе Инфо
    const statUnique = document.getElementById('statUnique');
    if (statUnique) statUnique.textContent = fmt(counters.unique);

    const statTotal = document.getElementById('statTotal');
    if (statTotal) statTotal.textContent = fmt(counters.total);

    const statToday = document.getElementById('statToday');
    if (statToday) statToday.textContent = fmt(counters.today);

    const statOnline = document.getElementById('statOnline');
    if (statOnline) statOnline.textContent = '1 в сети';

    const visitsEl = document.getElementById('visits');
    if (visitsEl) visitsEl.textContent = fmt(counters.total);
  }

  // Запуск
  function initAnalytics() {
    const counters = updateCounters();
    renderKPIs(counters);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalytics);
  } else {
    initAnalytics();
  }
})();
