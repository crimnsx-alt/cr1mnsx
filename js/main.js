/**
 * PlayStation®5 System UI — 1:1 Reference Controller
 * Supports all 3 reference views:
 *   1. 'welcome-en' (Dark Topographic Welcome Hub)
 *   2. 'welcome-ru' (Russian Cherry Blossom Центр приветствия)
 *   3. 'explore'    (PS5 Explore — Meet the family)
 */

(() => {
  'use strict';

  const navAudio = new Audio('assets/audio/navigation.wav');
  const actAudio = new Audio('assets/audio/activation.wav');
  navAudio.volume = 0.45;
  actAudio.volume = 0.55;

  function playNav() {
    try {
      navAudio.currentTime = 0;
      navAudio.play().catch(() => {});
    } catch (_) {}
  }

  function playAct() {
    try {
      actAudio.currentTime = 0;
      actAudio.play().catch(() => {});
    } catch (_) {}
  }

  const SCREENS = ['welcome-en', 'explore', 'welcome-ru'];
  const state = {
    currentScreen: 'welcome-en',
    psnRecent: null,
    psnGames: null,
    brawlData: null
  };

  const viewWelcomeEn = document.getElementById('viewWelcomeEn');
  const viewWelcomeRu = document.getElementById('viewWelcomeRu');
  const viewExplore = document.getElementById('viewExplore');

  const bgWelcomeEn = document.getElementById('bgWelcomeEn');
  const bgWelcomeRu = document.getElementById('bgWelcomeRu');
  const bgExplore = document.getElementById('bgExplore');

  const modalBackdrop = document.getElementById('ps5ModalBackdrop');
  const modalKicker = document.getElementById('ps5ModalKicker');
  const modalTitle = document.getElementById('ps5ModalTitle');
  const modalBody = document.getElementById('ps5ModalBody');
  const modalClose = document.getElementById('ps5ModalClose');

  function switchScreen(targetScreen, withSound = true) {
    if (!SCREENS.includes(targetScreen)) return;
    if (withSound && state.currentScreen !== targetScreen) {
      playNav();
    }
    state.currentScreen = targetScreen;

    viewWelcomeEn.hidden = targetScreen !== 'welcome-en';
    viewWelcomeRu.hidden = targetScreen !== 'welcome-ru';
    viewExplore.hidden = targetScreen !== 'explore';

    bgWelcomeEn.classList.toggle('is-active', targetScreen === 'welcome-en');
    bgWelcomeRu.classList.toggle('is-active', targetScreen === 'welcome-ru');
    bgExplore.classList.toggle('is-active', targetScreen === 'explore');
  }

  async function loadTelemetry() {
    try {
      const [psnRes, gamesRes, brawlRes] = await Promise.allSettled([
        fetch('data/psn_recent.json').then((r) => (r.ok ? r.json() : null)),
        fetch('data/psn_games.json').then((r) => (r.ok ? r.json() : null)),
        fetch('data/brawl.json').then((r) => (r.ok ? r.json() : null))
      ]);
      if (psnRes.status === 'fulfilled') state.psnRecent = psnRes.value;
      if (gamesRes.status === 'fulfilled') state.psnGames = gamesRes.value;
      if (brawlRes.status === 'fulfilled') state.brawlData = brawlRes.value;
    } catch (_) {}
  }

  function openModal(type) {
    playAct();
    modalBackdrop.hidden = false;
    modalBody.innerHTML = '';

    if (type === 'brawl' && state.brawlData) {
      const b = state.brawlData;
      modalKicker.textContent = 'SUPERCELL LIVE API · #P9J22J99';
      modalTitle.textContent = `${b.name || 'cr1mnsx'} — Brawl Stars Live Stats`;

      const stats = [
        ['Current Trophies', `${(b.trophies || 0).toLocaleString()} 🏆`],
        ['Highest Trophies', `${(b.highestTrophies || 0).toLocaleString()} 🏆`],
        ['3v3 Victories', String(b['3vs3Victories'] || 0)],
        ['Solo / Duo Wins', `${b.soloVictories || 0} Solo · ${b.duoVictories || 0} Duo`]
      ];
      stats.forEach(([k, v]) => {
        const el = document.createElement('div');
        el.className = 'ps5-telemetry-item';
        el.innerHTML = `<h4>${k}</h4><p>${v}</p>`;
        modalBody.appendChild(el);
      });

      const brawlers = Array.isArray(b.brawlers)
        ? [...b.brawlers].sort((a, c) => (c.trophies || 0) - (a.trophies || 0)).slice(0, 12)
        : [];
      brawlers.forEach((br) => {
        const el = document.createElement('div');
        el.className = 'ps5-telemetry-item';
        el.innerHTML = `<h4>${br.name} (Rank ${br.rank || '—'})</h4><p>${br.trophies} 🏆 · Power ${br.power || 11}</p>`;
        modalBody.appendChild(el);
      });
      return;
    }

    modalKicker.textContent = 'PLAYSTATION®NETWORK · CR1MNSX';
    modalTitle.textContent = 'PS5 Profile, Trophies (709 🏆) & Synced Games';

    const t = state.psnRecent?.trophies || { platinum: 2, gold: 21, silver: 138, bronze: 548, level: 199 };
    const summaryEl = document.createElement('div');
    summaryEl.className = 'ps5-telemetry-item';
    summaryEl.innerHTML = `<h4>PSN Trophy Summary (Level ${t.level || 199})</h4><p>🏆 ${t.platinum || 2} Plat · 🥇 ${t.gold || 21} Gold · 🥈 ${t.silver || 138} Silver · 🥉 ${t.bronze || 548} Bronze</p>`;
    modalBody.appendChild(summaryEl);

    if (state.brawlData?.trophies) {
      const brawlEl = document.createElement('div');
      brawlEl.className = 'ps5-telemetry-item';
      brawlEl.innerHTML = `<h4>Brawl Stars (#P9J22J99)</h4><p>${state.brawlData.trophies.toLocaleString()} 🏆 · 3v3 Wins: ${state.brawlData['3vs3Victories'] || 0}</p>`;
      modalBody.appendChild(brawlEl);
    }

    const gamesList = Array.isArray(state.psnGames?.games)
      ? state.psnGames.games
      : Array.isArray(state.psnGames)
      ? state.psnGames
      : [
          { name: 'Dark Souls Remastered', platform: 'PS4', playDuration: '64h', progress: 42 },
          { name: 'Dark Souls II: Scholar of the First Sin', platform: 'PS4', playDuration: '51h', progress: 38 },
          { name: 'Red Dead Redemption 2', platform: 'PS4', playDuration: '145h', progress: 78 },
          { name: 'HELLDIVERS™ 2', platform: 'PS5', playDuration: '58h', progress: 61 },
          { name: 'The Witcher 3: Wild Hunt', platform: 'PS5', playDuration: '112h', progress: 85 }
        ];

    gamesList.slice(0, 16).forEach((g) => {
      const el = document.createElement('div');
      el.className = 'ps5-telemetry-item';
      const title = g.name || g.title || 'PS5 Game';
      const sub = `${g.platform || 'PS5'} · ${g.playDuration || g.hours || 'Played'} ${g.progress ? `· ${g.progress}%` : ''}`;
      el.innerHTML = `<h4>${title}</h4><p>${sub}</p>`;
      modalBody.appendChild(el);
    });
  }

  function initEvents() {
    document.addEventListener('click', (e) => {
      const switchBtn = e.target.closest('[data-switch-screen]');
      if (switchBtn) {
        switchScreen(switchBtn.dataset.switchScreen, true);
        return;
      }

      const modalSwitchBtn = e.target.closest('[data-modal-switch]');
      if (modalSwitchBtn) {
        modalBackdrop.hidden = true;
        switchScreen(modalSwitchBtn.dataset.modalSwitch, true);
        return;
      }

      const openModalBtn = e.target.closest('[data-open-modal]');
      if (openModalBtn) {
        openModal(openModalBtn.dataset.openModal);
        return;
      }
    });

    modalClose?.addEventListener('click', () => {
      playNav();
      modalBackdrop.hidden = true;
    });

    modalBackdrop?.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        playNav();
        modalBackdrop.hidden = true;
      }
    });

    window.addEventListener('keydown', (e) => {
      if (!modalBackdrop.hidden) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          playNav();
          modalBackdrop.hidden = true;
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        const idx = SCREENS.indexOf(state.currentScreen);
        switchScreen(SCREENS[(idx + 1) % SCREENS.length], true);
      } else if (e.key === 'ArrowLeft') {
        const idx = SCREENS.indexOf(state.currentScreen);
        switchScreen(SCREENS[(idx - 1 + SCREENS.length) % SCREENS.length], true);
      } else if (e.key === '1') {
        switchScreen('welcome-en', true);
      } else if (e.key === '2') {
        switchScreen('explore', true);
      } else if (e.key === '3') {
        switchScreen('welcome-ru', true);
      }
    });
  }

  initEvents();
  loadTelemetry();
})();
