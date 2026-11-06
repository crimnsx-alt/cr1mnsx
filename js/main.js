/**
 * PlayStation®5 System Software UI — Interactive Controller
 * Unified Top Bar + Game Ribbon + Welcome Hub + Explore / Game Hub
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

  const state = {
    activeTileId: 'welcome',
    isRuLiveMode: false,
    psnRecent: null,
    psnGames: null,
    brawlData: null
  };

  const TILE_META = {
    welcome: {
      isWelcome: true,
      bg: 'assets/ps5ish/crops/ps5-welcome-bg.png'
    },
    psplus: {
      kicker: 'PlayStation®Plus | Active Membership',
      title: 'PlayStation Plus Game Catalog',
      desc: 'Discover hundreds of PS5 and PS4 titles, monthly games, and exclusive cloud storage for cr1mnsx.',
      bg: 'assets/ps5ish/crops/ps5-explore-bg.png'
    },
    store: {
      kicker: 'Official news from PlayStation | 32 minutes ago',
      title: 'Meet the family',
      desc: 'From the Media Remote to the PS5 consoles themselves, take a visual tour of the PlayStation 5 hardware family.',
      bg: 'assets/ps5ish/crops/ps5-explore-bg.png'
    },
    uncharted: {
      kicker: 'PlayStation®5 Game | Installed · 68% Complete',
      title: 'UNCHARTED: Legacy of Thieves',
      desc: 'Seek your fortune and leave your mark on the map in UNCHARTED 4: A Thief’s End and UNCHARTED: The Lost Legacy.',
      bg: 'assets/photos/games/farcry3.png'
    },
    astrobot: {
      kicker: 'Official news from PlayStation | Game of the Year',
      title: 'ASTRO BOT',
      desc: 'Blast off on a brand-new supersized space adventure with ASTRO across more than 50 exciting planets.',
      bg: 'assets/ps5ish/crops/ps5-explore-bg.png'
    },
    'astro-playroom': {
      kicker: 'Pre-installed on PS5 | Platinum Trophy Unlocked',
      title: "ASTRO's PLAYROOM",
      desc: 'Explore four worlds, each based on PS5 console components, showcasing the DualSense™ wireless controller.',
      bg: 'assets/ps5ish/crops/ps5-explore-bg.png'
    },
    tlou2: {
      kicker: 'PlayStation®5 Remastered | No Return Mode Available',
      title: 'The Last of Us™ Part II Remastered',
      desc: 'Experience the winner of over 300 Game of the Year awards with native PS5 enhancements and DualSense integration.',
      bg: 'assets/photos/games/until-dawn.png'
    },
    remoteplay: {
      kicker: 'Official news from PlayStation | 32 minutes ago',
      title: 'Meet the family',
      desc: 'From the Media Remote to the PS5 consoles themselves, take a visual tour of the PlayStation 5 hardware family.',
      bg: 'assets/ps5ish/crops/ps5-explore-bg.png'
    },
    library: {
      kicker: 'PlayStation®Network Telemetry | cr1mnsx · 19 Synced Games',
      title: 'Game Library & Live Stats',
      desc: 'Dark Souls Remastered, Dark Souls II, Red Dead Redemption 2, HELLDIVERS 2, The Witcher 3 & Brawl Stars (#P9J22J99).',
      bg: 'assets/photos/games/ds1-remastered.png'
    }
  };

  // DOM Elements
  const ribbonEl = document.getElementById('ps5GamesRibbon');
  const welcomeViewEl = document.getElementById('ps5WelcomeView');
  const exploreViewEl = document.getElementById('ps5ExploreView');
  const bgArtEl = document.getElementById('ps5BgArt');
  const clockEl = document.getElementById('ps5Clock');
  const tabGames = document.getElementById('tabGames');
  const tabMedia = document.getElementById('tabMedia');

  // Welcome Hub Labels & Trophy Numbers
  const welcomeTileLabel = document.getElementById('welcomeTileLabel');
  const lblOnlineFriends = document.getElementById('lblOnlineFriends');
  const lblAccessibility = document.getElementById('lblAccessibility');
  const lblAccessibilityDesc = document.getElementById('lblAccessibilityDesc');
  const lblTrophies = document.getElementById('lblTrophies');
  const trophiesTotalEl = document.getElementById('ps5TrophiesTotal');
  const countPlatEl = document.getElementById('ps5CountPlat');
  const countGoldEl = document.getElementById('ps5CountGold');
  const countSilverEl = document.getElementById('ps5CountSilver');
  const countBronzeEl = document.getElementById('ps5CountBronze');
  const trophyLevelEl = document.getElementById('ps5TrophyLevel');
  const trophyPctEl = document.getElementById('ps5TrophyPct');
  const trophyBarFillEl = document.getElementById('ps5TrophyBarFill');

  // Explore Hero Elements
  const exploreKicker = document.getElementById('exploreKicker');
  const exploreTitle = document.getElementById('exploreTitle');
  const exploreDesc = document.getElementById('exploreDesc');

  // Modal Elements
  const modalBackdrop = document.getElementById('ps5ModalBackdrop');
  const modalKicker = document.getElementById('ps5ModalKicker');
  const modalTitle = document.getElementById('ps5ModalTitle');
  const modalBody = document.getElementById('ps5ModalBody');
  const modalClose = document.getElementById('ps5ModalClose');

  function applyLanguageAndDataMode() {
    if (!state.isRuLiveMode) {
      // Exact 1:1 English Reference Mode
      tabGames.textContent = 'Games';
      tabMedia.textContent = 'Media';
      if (welcomeTileLabel) welcomeTileLabel.textContent = 'Welcome';
      if (lblOnlineFriends) lblOnlineFriends.textContent = 'Online Friends';
      if (lblAccessibility) lblAccessibility.textContent = 'Accessibility';
      if (lblAccessibilityDesc) lblAccessibilityDesc.textContent = 'Make your PS5 more usable for you.';
      if (lblTrophies) lblTrophies.textContent = 'Trophies';
      trophiesTotalEl.textContent = 'Total: 380';
      countPlatEl.textContent = '1';
      countGoldEl.textContent = '20';
      countSilverEl.textContent = '67';
      countBronzeEl.textContent = '292';
      trophyLevelEl.textContent = 'Level 128';
      trophyPctEl.textContent = '33%';
      trophyBarFillEl.style.width = '33%';
      clockEl.textContent = '10:24AM';
    } else {
      // Russian + Live cr1mnsx PSN Telemetry Mode
      const t = state.psnRecent?.trophies || { platinum: 2, gold: 21, silver: 138, bronze: 548, total: 709, level: 199, progress: 33 };
      const total = t.total || (t.platinum + t.gold + t.silver + t.bronze) || 709;
      tabGames.textContent = 'Игры';
      tabMedia.textContent = 'Медиа';
      if (welcomeTileLabel) welcomeTileLabel.textContent = 'Центр приветствия';
      if (lblOnlineFriends) lblOnlineFriends.textContent = 'Друзья в сети';
      if (lblAccessibility) lblAccessibility.textContent = 'Специальные возможности';
      if (lblAccessibilityDesc) lblAccessibilityDesc.textContent = 'Сделайте PS5 удобнее для себя.';
      if (lblTrophies) lblTrophies.textContent = 'Призы';
      trophiesTotalEl.textContent = `Всего: ${total}`;
      countPlatEl.textContent = String(t.platinum ?? 2);
      countGoldEl.textContent = String(t.gold ?? 21);
      countSilverEl.textContent = String(t.silver ?? 138);
      countBronzeEl.textContent = String(t.bronze ?? 548);
      trophyLevelEl.textContent = `Уровень ${t.level ?? 199}`;
      trophyPctEl.textContent = `${t.progress ?? 33}%`;
      trophyBarFillEl.style.width = `${t.progress ?? 33}%`;

      const now = new Date();
      clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
  }

  function selectTile(tileId, withSound = true) {
    const tiles = Array.from(ribbonEl.querySelectorAll('.ps5-tile'));
    const target = tiles.find((btn) => btn.dataset.tileId === tileId);
    if (!target) return;

    if (withSound && state.activeTileId !== tileId) {
      playNav();
    }
    state.activeTileId = tileId;

    tiles.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tileId === tileId);
    });

    const meta = TILE_META[tileId] || TILE_META.welcome;
    if (bgArtEl && meta.bg) {
      bgArtEl.style.backgroundImage = `url('${meta.bg}')`;
    }

    if (meta.isWelcome) {
      welcomeViewEl.hidden = false;
      exploreViewEl.hidden = true;
      tabGames.classList.add('is-active');
      tabMedia.classList.remove('is-active');
    } else {
      welcomeViewEl.hidden = true;
      exploreViewEl.hidden = false;
      const heroEl = document.querySelector('.ps5-explore-hero');
      if (heroEl) {
        heroEl.style.opacity = meta.bg.includes('ps5-explore-bg.png') ? '0' : '1';
      }
      exploreKicker.textContent = meta.kicker || 'Official news from PlayStation | 32 minutes ago';
      exploreTitle.textContent = meta.title || 'Meet the family';
      exploreDesc.textContent =
        meta.desc ||
        'From the Media Remote to the PS5 consoles themselves, take a visual tour of the PlayStation 5 hardware family.';
    }
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
      modalTitle.textContent = `${b.name || 'cr1mnsx'} — Brawl Stars Telemetry`;

      const stats = [
        ['Current Trophies', `${(b.trophies || 0).toLocaleString()} 🏆`],
        ['Highest Trophies', `${(b.highestTrophies || 0).toLocaleString()} 🏆`],
        ['3v3 Victories', String(b['3vs3Victories'] || 0)],
        ['Solo / Duo Wins', `${b.soloVictories || 0} Solo · ${b.duoVictories || 0} Duo`]
      ];
      stats.forEach(([k, v]) => {
        const div = document.createElement('div');
        div.className = 'ps5-telemetry-item';
        div.innerHTML = `<h4>${k}</h4><p>${v}</p>`;
        modalBody.appendChild(div);
      });

      const brawlers = Array.isArray(b.brawlers)
        ? [...b.brawlers].sort((a, c) => (c.trophies || 0) - (a.trophies || 0)).slice(0, 12)
        : [];
      brawlers.forEach((br) => {
        const div = document.createElement('div');
        div.className = 'ps5-telemetry-item';
        div.innerHTML = `<h4>${br.name} (Rank ${br.rank || '—'})</h4><p>${br.trophies} 🏆 · Power ${br.power || 11}</p>`;
        modalBody.appendChild(div);
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
      const div = document.createElement('div');
      div.className = 'ps5-telemetry-item';
      const title = g.name || g.title || 'PS5 Title';
      const sub = `${g.platform || 'PS5'} · ${g.playDuration || g.hours || 'Played'} ${g.progress ? `· ${g.progress}%` : ''}`;
      div.innerHTML = `<h4>${title}</h4><p>${sub}</p>`;
      modalBody.appendChild(div);
    });
  }

  function initEvents() {
    const tileOrder = ['psplus', 'store', 'welcome', 'uncharted', 'astrobot', 'astro-playroom', 'tlou2', 'remoteplay', 'library'];

    ribbonEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.ps5-tile');
      if (!btn) return;
      if (btn.dataset.tileId === 'library') {
        selectTile('library', true);
        openModal('psn');
        return;
      }
      selectTile(btn.dataset.tileId, true);
    });

    tabGames?.addEventListener('click', () => selectTile('welcome', true));
    tabMedia?.addEventListener('click', () => {
      tabMedia.classList.add('is-active');
      tabGames.classList.remove('is-active');
      selectTile('store', true);
    });

    document.getElementById('ps5SearchBtn')?.addEventListener('click', () => selectTile('store', true));
    document.getElementById('ps5SettingsBtn')?.addEventListener('click', () => {
      playAct();
      state.isRuLiveMode = !state.isRuLiveMode;
      applyLanguageAndDataMode();
    });
    document.getElementById('ps5ProfileBtn')?.addEventListener('click', () => openModal('psn'));

    document.getElementById('widgetTrophies')?.addEventListener('click', () => {
      playAct();
      state.isRuLiveMode = !state.isRuLiveMode;
      applyLanguageAndDataMode();
    });
    document.getElementById('widgetFriends')?.addEventListener('click', () => openModal('psn'));
    document.getElementById('widgetStore')?.addEventListener('click', () => selectTile('store', true));
    document.getElementById('widgetWishlist')?.addEventListener('click', () => selectTile('store', true));
    document.getElementById('widgetFriendActivity')?.addEventListener('click', () => selectTile('store', true));
    document.getElementById('ps5ChevronLeft')?.addEventListener('click', () => {
      const idx = tileOrder.indexOf(state.activeTileId);
      selectTile(tileOrder[(idx - 1 + tileOrder.length) % tileOrder.length], true);
    });

    document.querySelectorAll('[data-open-modal]').forEach((el) => {
      el.addEventListener('click', () => openModal(el.dataset.openModal));
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
        const idx = tileOrder.indexOf(state.activeTileId);
        selectTile(tileOrder[(idx + 1) % tileOrder.length], true);
      } else if (e.key === 'ArrowLeft') {
        const idx = tileOrder.indexOf(state.activeTileId);
        selectTile(tileOrder[(idx - 1 + tileOrder.length) % tileOrder.length], true);
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        selectTile('welcome', true);
      }
    });
  }

  applyLanguageAndDataMode();
  initEvents();
  loadTelemetry();
})();
