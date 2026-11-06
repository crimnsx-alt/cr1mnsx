/**
 * PlayStation 5 System Software UI (Welcome Hub + Game Hub)
 * 1:1 Reference Recreation + Live cr1mnsx PSN & Brawl Stars Telemetry
 */

(() => {
  'use strict';

  // --- Audio System (Authentic PS5ish WAVs + WebAudio fallback) ---
  const navAudio = new Audio('assets/audio/navigation.wav');
  const actAudio = new Audio('assets/audio/activation.wav');
  navAudio.volume = 0.45;
  actAudio.volume = 0.55;

  function playNavSound() {
    try {
      navAudio.currentTime = 0;
      navAudio.play().catch(() => {});
    } catch (_) {}
  }

  function playActSound() {
    try {
      actAudio.currentTime = 0;
      actAudio.play().catch(() => {});
    } catch (_) {}
  }

  // --- Live Telemetry State ---
  const state = {
    activeTileId: 'welcome',
    isLiveDataMode: false, // false = exact PS5 reference (380 trophies, 10:24AM), true = live cr1mnsx stats
    psnRecent: null,
    psnGames: null,
    brawlData: null
  };

  // --- Game Tile Metadata Catalog ---
  const GAME_CATALOG = {
    welcome: {
      title: 'Welcome',
      isWelcome: true,
      bg: 'assets/ps5ish/crops/ps5-welcome-bg.png'
    },
    psplus: {
      title: 'PlayStation®Plus',
      platform: 'PS5',
      status: 'Active Member',
      subtitle: 'Discover hundreds of PS5 & PS4 games in the Game Catalog.',
      progress: '100%',
      hours: '340h',
      trophies: '19 / 19',
      bg: 'assets/ps5ish/crops/ps5-welcome-bg.png',
      act1: ['MONTHLY GAMES', 'Claim PlayStation Plus Lineup', 'Available now'],
      act2: ['CLOUD STORAGE', 'Auto-Sync Saved Data Enabled', 'PS5 Console Storage'],
      act3: ['ONLINE MULTIPLAYER', 'cr1mnsx Party Ready', '4 Friends Online']
    },
    store: {
      title: 'PlayStation™Store',
      platform: 'PS5',
      status: 'Featured',
      subtitle: 'Horizon Forbidden West™ · Gran Turismo® 7 · ASTRO BOT',
      progress: '—',
      hours: '—',
      trophies: 'Store',
      bg: 'assets/photos/games/witcher3.png',
      act1: ['FEATURED DEAL', 'Horizon Forbidden West™ Complete Edition', 'PS5 & PS4'],
      act2: ['WISHLIST', 'Gran Turismo® 7 — Standard Edition', 'On Your Wishlist'],
      act3: ['NEW RELEASE', 'ASTRO BOT — Game of the Year Edition', 'PS5 Exclusive']
    },
    uncharted: {
      title: 'UNCHARTED: Legacy of Thieves Collection',
      platform: 'PS5',
      status: 'Installed',
      subtitle: 'Seek your fortune and leave your mark on the map in UNCHARTED 4 & The Lost Legacy.',
      progress: '68%',
      hours: '38h',
      trophies: '34 / 50',
      bg: 'assets/photos/games/farcry3.png',
      act1: ['CHAPTER 12 · AT SEA', 'Continue Exploring Madagascar', '68% Completed'],
      act2: ['TROPHY UNLOCKED', 'One Last Time · Silver Trophy', 'Earned on PS5'],
      act3: ['MEDIA GALLERY', '4K HDR Screenshot Captured', ' Libertalia Ruins']
    },
    astrobot: {
      title: 'ASTRO BOT',
      platform: 'PS5',
      status: 'Installed',
      subtitle: 'Blast off on a brand-new supersized space adventure with ASTRO!',
      progress: '84%',
      hours: '24h',
      trophies: '37 / 44',
      bg: 'assets/ps5ish/crops/ps5-welcome-bg.png',
      act1: ['GALAXY PROGRESS', '264 / 300 VIP Bots Rescued', '88% Complete'],
      act2: ['SPEEDRUN STAGE', 'Building Speed — 00:41.22', 'Top 5% Worldwide'],
      act3: ['DUALSENSE™ HAPTICS', 'Adaptive Triggers & Speaker Active', 'Controller 1']
    },
    'astro-playroom': {
      title: "ASTRO's PLAYROOM",
      platform: 'PS5',
      status: 'Platinum Earned',
      subtitle: 'Explore four worlds, each based on PS5 console components.',
      progress: '100%',
      hours: '11h',
      trophies: '46 / 46',
      bg: 'assets/ps5ish/crops/ps5-welcome-bg.png',
      act1: ['PLATINUM TROPHY', 'You’ve Only Done Everything!', '100% Completed'],
      act2: ['PS LABO ARTIFACTS', 'All PlayStation History Items Collected', 'PlayStation®5 Museum'],
      act3: ['COOLING SPRINGS', 'Speedrun Record Verified', 'Online Leaderboard']
    },
    tlou2: {
      title: 'The Last of Us™ Part II Remastered',
      platform: 'PS5',
      status: 'Installed',
      subtitle: 'Experience the winner of over 300 Game of the Year awards with No Return mode.',
      progress: '92%',
      hours: '54h',
      trophies: '41 / 45',
      bg: 'assets/photos/games/until-dawn.png',
      act1: ['NO RETURN · ROGUELIKE', 'Daily Run: Ellie in Seattle Day 2', 'High Score: 8,420'],
      act2: ['STORY CAMPAIGN', 'Seattle Day 3 — The Aquarium', '92% Completed'],
      act3: ['GUITAR FREE PLAY', 'Unlocked Acoustic & Banjo Sets', 'Bonus Mode']
    },
    remoteplay: {
      title: 'PS Remote Play',
      platform: 'PS5',
      status: 'Ready to Connect',
      subtitle: 'Stream your PS5 games to Mac, PC, iPhone, iPad, or PlayStation Portal™.',
      progress: '100%',
      hours: '62h',
      trophies: 'System',
      bg: 'assets/ps5ish/crops/ps5-welcome-bg.png',
      act1: ['LOCAL NETWORK', '1080p 60fps Low-Latency Stream Ready', 'cr1mnsx-PS5'],
      act2: ['DUALSENSE PAIRING', 'Wireless Controller Connected', 'Battery 85%'],
      act3: ['QUICK CONNECT', 'View Paired Devices & History', 'Click to inspect']
    },
    library: {
      title: 'Game Library',
      platform: 'PS5',
      status: '19 Games Synced',
      subtitle: 'Your complete PlayStation®5 and PlayStation®4 collection for cr1mnsx.',
      progress: '709 🏆',
      hours: '820h+',
      trophies: 'Level 199',
      bg: 'assets/photos/games/witcher3.png',
      act1: ['INSTALLED (19)', 'Dark Souls, RDR2, Helldivers 2, Witcher 3', 'Click to browse all'],
      act2: ['PLATINUM CLUB', '2 Platinum · 21 Gold · 138 Silver · 548 Bronze', 'Total: 709 Trophies'],
      act3: ['BRAWL STARS LINKED', 'Live Supercell API (#P9J22J99)', 'Click to open full drawer']
    },
    ds1: {
      title: 'Dark Souls™: Remastered',
      platform: 'PS4 / PS5',
      status: 'Recently Played',
      subtitle: 'Then, there was fire. Re-experience the critically acclaimed genre-defining game.',
      progress: '42%',
      hours: '64h',
      trophies: '18 / 41',
      bg: 'assets/photos/games/ds1-remastered.png',
      act1: ['ANOR LONDO', 'Defeat Dragon Slayer Ornstein & Executioner Smough', 'In Progress · 75%'],
      act2: ['LORDVESSEL', 'Acquire the Lordvessel from Gwynevere', 'Gold Trophy Milestone'],
      act3: ['BONFIRE KINDLED', 'Firelink Shrine Restored', 'Saved to Cloud']
    },
    brawlstars: {
      title: 'Brawl Stars — cr1mnsx (#P9J22J99)',
      platform: 'LIVE API',
      status: 'Online Synced',
      subtitle: 'Real-time Supercell telemetry: Trophies, 3v3 Victories, Solo/Duo Wins & Top Brawlers.',
      progress: '100%',
      hours: 'Live',
      trophies: '30,500+ 🏆',
      bg: 'assets/photos/brawl-stars-banner.jpg',
      act1: ['LIVE TROPHIES', 'Loading live trophy count from data/brawl.json...', 'Auto-updated via GitHub Actions'],
      act2: ['VICTORIES RECORD', '3v3, Solo & Duo Showdown Breakdown', 'Click to view full roster'],
      act3: ['TOP BRAWLERS', 'Inspect Highest Rank Brawlers', 'Open Telemetry Drawer']
    },
    rdr2: {
      title: 'Red Dead Redemption 2',
      platform: 'PS4 / PS5',
      status: 'Installed',
      subtitle: 'America, 1899. Arthur Morgan and the Van der Linde gang are outlaws on the run.',
      progress: '78%',
      hours: '145h',
      trophies: '36 / 52',
      bg: 'assets/photos/games/rdr2.png',
      act1: ['CHAPTER VI · BEAVER HOLLOW', 'Our Best Selves — Story Mission', '78% Completed'],
      act2: ['COMPENDIUM', 'Legendary Animals & Gunslingers Tracked', '84% Discovered'],
      act3: ['RED DEAD ONLINE', 'Bounty Hunter & Trader Roles Active', 'cr1mnsx Posse']
    },
    helldivers2: {
      title: 'HELLDIVERS™ 2',
      platform: 'PS5',
      status: 'Installed',
      subtitle: 'Spread Managed Democracy across the galaxy in intense co-op squad combat.',
      progress: '61%',
      hours: '58h',
      trophies: '24 / 39',
      bg: 'assets/photos/games/helldivers2.png',
      act1: ['MAJOR ORDER', 'Defend Super Earth Outer Sectors', 'Galactic War Active'],
      act2: ['SUPER DESTROYER', 'Eagle 500kg Bomb & Orbital Laser Upgraded', 'Ship Modules'],
      act3: ['SQUAD DEPLOYMENT', 'Quickplay SOS Beacon Ready', '4/4 Helldivers']
    }
  };

  // --- DOM References ---
  const ribbonEl = document.getElementById('ps5GamesRibbon');
  const welcomeViewEl = document.getElementById('ps5WelcomeView');
  const gameDetailViewEl = document.getElementById('ps5GameDetailView');
  const bgArtEl = document.getElementById('ps5BgArt');
  const clockEl = document.getElementById('ps5Clock');
  const dataModeBtn = document.getElementById('ps5DataModeBtn');
  const dataModeLabel = document.getElementById('ps5DataModeLabel');

  // Trophy widget refs
  const trophiesTotalEl = document.getElementById('ps5TrophiesTotal');
  const countPlatEl = document.getElementById('ps5CountPlat');
  const countGoldEl = document.getElementById('ps5CountGold');
  const countSilverEl = document.getElementById('ps5CountSilver');
  const countBronzeEl = document.getElementById('ps5CountBronze');
  const trophyLevelEl = document.getElementById('ps5TrophyLevel');
  const trophyPctEl = document.getElementById('ps5TrophyPct');
  const trophyBarFillEl = document.getElementById('ps5TrophyBarFill');

  // Game Hub refs
  const gameDetailPlatform = document.getElementById('gameDetailPlatform');
  const gameDetailStatus = document.getElementById('gameDetailStatus');
  const gameDetailTitle = document.getElementById('gameDetailTitle');
  const gameDetailSubtitle = document.getElementById('gameDetailSubtitle');
  const gameDetailProgress = document.getElementById('gameDetailProgress');
  const gameDetailHours = document.getElementById('gameDetailHours');
  const gameDetailTrophies = document.getElementById('gameDetailTrophies');
  const act1Kicker = document.getElementById('act1Kicker');
  const act1Title = document.getElementById('act1Title');
  const act1Meta = document.getElementById('act1Meta');
  const act2Kicker = document.getElementById('act2Kicker');
  const act2Title = document.getElementById('act2Title');
  const act2Meta = document.getElementById('act2Meta');
  const act3Kicker = document.getElementById('act3Kicker');
  const act3Title = document.getElementById('act3Title');
  const act3Meta = document.getElementById('act3Meta');

  // Modal refs
  const modalBackdrop = document.getElementById('ps5ModalBackdrop');
  const modalTitle = document.getElementById('ps5ModalTitle');
  const modalKicker = document.getElementById('ps5ModalKicker');
  const modalBody = document.getElementById('ps5ModalBody');
  const modalClose = document.getElementById('ps5ModalClose');

  // --- Clock Formatting (10:24AM style) ---
  function updateClock() {
    if (!clockEl) return;
    if (!state.isLiveDataMode) {
      clockEl.textContent = '10:24AM';
      return;
    }
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    clockEl.textContent = `${hours}:${minutes}${ampm}`;
  }

  // --- Apply Reference vs Live cr1mnsx Data Mode ---
  function applyDataMode() {
    if (!state.isLiveDataMode) {
      // Exact 1:1 numbers from the reference PS5 Welcome Hub screenshot
      trophiesTotalEl.textContent = 'Total: 380';
      countPlatEl.textContent = '1';
      countGoldEl.textContent = '20';
      countSilverEl.textContent = '67';
      countBronzeEl.textContent = '292';
      trophyLevelEl.textContent = 'Level 128';
      trophyPctEl.textContent = '33%';
      trophyBarFillEl.style.width = '33%';
      if (dataModeLabel) dataModeLabel.textContent = 'Mode: PS5 Ref (Click for Live cr1mnsx)';
    } else {
      // Live cr1mnsx PSN Telemetry
      const t = state.psnRecent?.trophies || { platinum: 2, gold: 21, silver: 138, bronze: 548, total: 709, level: 199, progress: 33 };
      const total = t.total || (t.platinum + t.gold + t.silver + t.bronze) || 709;
      trophiesTotalEl.textContent = `Total: ${total}`;
      countPlatEl.textContent = String(t.platinum ?? 2);
      countGoldEl.textContent = String(t.gold ?? 21);
      countSilverEl.textContent = String(t.silver ?? 138);
      countBronzeEl.textContent = String(t.bronze ?? 548);
      trophyLevelEl.textContent = `Level ${t.level ?? 199}`;
      trophyPctEl.textContent = `${t.progress ?? 33}%`;
      trophyBarFillEl.style.width = `${t.progress ?? 33}%`;
      if (dataModeLabel) dataModeLabel.textContent = 'Mode: Live cr1mnsx PSN';
    }
    updateClock();
  }

  // --- Select Tile in Ribbon ---
  function selectTile(tileId, playAudio = true) {
    const tiles = Array.from(ribbonEl.querySelectorAll('.ps5-tile'));
    const targetBtn = tiles.find((btn) => btn.dataset.tileId === tileId);
    if (!targetBtn) return;

    if (playAudio && state.activeTileId !== tileId) {
      playNavSound();
    }
    state.activeTileId = tileId;

    tiles.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tileId === tileId);
    });

    const meta = GAME_CATALOG[tileId] || GAME_CATALOG.welcome;

    // Update Background Artwork
    if (bgArtEl && meta.bg) {
      bgArtEl.style.backgroundImage = `url('${meta.bg}')`;
    }

    // Switch between Welcome Hub and Game Hub View
    if (meta.isWelcome) {
      welcomeViewEl.hidden = false;
      gameDetailViewEl.hidden = true;
    } else {
      welcomeViewEl.hidden = true;
      gameDetailViewEl.hidden = false;

      gameDetailPlatform.textContent = meta.platform || 'PS5';
      gameDetailStatus.textContent = meta.status || 'Installed';
      gameDetailTitle.textContent = meta.title;
      gameDetailSubtitle.textContent = meta.subtitle || '';
      gameDetailProgress.textContent = meta.progress || '—';
      gameDetailHours.textContent = meta.hours || '—';
      gameDetailTrophies.textContent = meta.trophies || '—';

      if (meta.act1) {
        act1Kicker.textContent = meta.act1[0];
        act1Title.textContent = meta.act1[1];
        act1Meta.textContent = meta.act1[2];
      }
      if (meta.act2) {
        act2Kicker.textContent = meta.act2[0];
        act2Title.textContent = meta.act2[1];
        act2Meta.textContent = meta.act2[2];
      }
      if (meta.act3) {
        act3Kicker.textContent = meta.act3[0];
        act3Title.textContent = meta.act3[1];
        act3Meta.textContent = meta.act3[2];
      }
    }
  }

  // --- Load Live PSN & Brawl Stars JSON Data ---
  async function loadTelemetry() {
    try {
      const [psnRes, gamesRes, brawlRes] = await Promise.allSettled([
        fetch('data/psn_recent.json').then((r) => (r.ok ? r.json() : null)),
        fetch('data/psn_games.json').then((r) => (r.ok ? r.json() : null)),
        fetch('data/brawl.json').then((r) => (r.ok ? r.json() : null))
      ]);

      if (psnRes.status === 'fulfilled' && psnRes.value) {
        state.psnRecent = psnRes.value;
      }
      if (gamesRes.status === 'fulfilled' && gamesRes.value) {
        state.psnGames = gamesRes.value;
      }
      if (brawlRes.status === 'fulfilled' && brawlRes.value) {
        state.brawlData = brawlRes.value;
        const b = state.brawlData;
        if (b.trophies) {
          GAME_CATALOG.brawlstars.trophies = `${b.trophies.toLocaleString()} 🏆`;
          GAME_CATALOG.brawlstars.hours = `Lv.${b.expLevel || 180}`;
          GAME_CATALOG.brawlstars.act1 = [
            'LIVE TROPHIES',
            `${b.name || 'cr1mnsx'}: ${b.trophies.toLocaleString()} 🏆 (Best: ${(b.highestTrophies || b.trophies).toLocaleString()})`,
            'Synced via Supercell API'
          ];
          GAME_CATALOG.brawlstars.act2 = [
            'VICTORIES BREAKDOWN',
            `3v3: ${b['3vs3Victories'] || 0} · Solo: ${b.soloVictories || 0} · Duo: ${b.duoVictories || 0}`,
            `Club: ${b.club?.name || 'Independent'}`
          ];
        }
      }
    } catch (_) {}
  }

  // --- Open Telemetry Modal ---
  function openModal(type) {
    playActSound();
    modalBackdrop.hidden = false;
    modalBody.innerHTML = '';

    if (type === 'brawl' && state.brawlData) {
      const b = state.brawlData;
      modalKicker.textContent = 'SUPERCELL LIVE API · #P9J22J99';
      modalTitle.textContent = `${b.name || 'cr1mnsx'} — Brawl Stars Telemetry`;

      const summaryItems = [
        ['Current Trophies', `${(b.trophies || 0).toLocaleString()} 🏆`],
        ['Highest Trophies', `${(b.highestTrophies || 0).toLocaleString()} 🏆`],
        ['3v3 Victories', String(b['3vs3Victories'] || 0)],
        ['Solo / Duo Wins', `${b.soloVictories || 0} Solo · ${b.duoVictories || 0} Duo`]
      ];
      summaryItems.forEach(([title, val]) => {
        const div = document.createElement('div');
        div.className = 'ps5-telemetry-item';
        div.innerHTML = `<h4>${title}</h4><p>${val}</p>`;
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

    // Default: PSN Games & Trophies Modal
    modalKicker.textContent = 'PLAYSTATION®NETWORK · CR1MNSX';
    modalTitle.textContent = 'PS5 Library & Trophy Cabinet (Total: 709 🏆)';

    const gamesList = Array.isArray(state.psnGames?.games)
      ? state.psnGames.games
      : Array.isArray(state.psnGames)
      ? state.psnGames
      : [
          { name: 'Dark Souls Remastered', platform: 'PS4', playDuration: '64h', progress: 42 },
          { name: 'Dark Souls II: Scholar of the First Sin', platform: 'PS4', playDuration: '51h', progress: 38 },
          { name: 'Red Dead Redemption 2', platform: 'PS4', playDuration: '145h', progress: 78 },
          { name: 'HELLDIVERS™ 2', platform: 'PS5', playDuration: '58h', progress: 61 },
          { name: 'The Witcher 3: Wild Hunt', platform: 'PS5', playDuration: '112h', progress: 85 },
          { name: 'ASTRO BOT', platform: 'PS5', playDuration: '24h', progress: 84 }
        ];

    gamesList.slice(0, 18).forEach((g) => {
      const div = document.createElement('div');
      div.className = 'ps5-telemetry-item';
      const title = g.name || g.title || 'PS5 Title';
      const sub = `${g.platform || 'PS5'} · ${g.playDuration || g.hours || 'Played'} ${g.progress ? `· ${g.progress}%` : ''}`;
      div.innerHTML = `<h4>${title}</h4><p>${sub}</p>`;
      modalBody.appendChild(div);
    });
  }

  // --- Subtle Ambient Floating Dust Particles on #ps5Particles ---
  function initParticles() {
    const canvas = document.getElementById('ps5Particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    });

    const dots = Array.from({ length: 28 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.55,
      r: Math.random() * 1.6 + 0.5,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.12,
      a: Math.random() * 0.45 + 0.15
    }));

    function draw() {
      ctx.clearRect(0, 0, w, h);
      dots.forEach((d) => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x = w;
        if (d.x > w) d.x = 0;
        if (d.y < 0) d.y = h * 0.55;
        if (d.y > h * 0.55) d.y = 0;

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(125, 211, 252, ${d.a})`;
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  }

  // --- Wire Up Interactions ---
  function initEvents() {
    // Ribbon tile clicks
    ribbonEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.ps5-tile');
      if (!btn) return;
      selectTile(btn.dataset.tileId, true);
    });

    // Left / Right Chevrons cycle ribbon tiles
    const tileOrder = ['psplus', 'store', 'welcome', 'uncharted', 'astrobot', 'astro-playroom', 'tlou2', 'remoteplay', 'library', 'ds1', 'brawlstars', 'rdr2', 'helldivers2'];

    document.getElementById('ps5ChevronLeft')?.addEventListener('click', () => {
      const idx = tileOrder.indexOf(state.activeTileId);
      const prev = tileOrder[(idx - 1 + tileOrder.length) % tileOrder.length];
      selectTile(prev, true);
    });

    document.getElementById('ps5ChevronRight')?.addEventListener('click', () => {
      const idx = tileOrder.indexOf(state.activeTileId);
      const next = tileOrder[(idx + 1) % tileOrder.length];
      selectTile(next, true);
    });

    // Keyboard navigation (ArrowLeft / ArrowRight / Escape)
    window.addEventListener('keydown', (e) => {
      if (!modalBackdrop.hidden) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          playNavSound();
          modalBackdrop.hidden = true;
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        const idx = tileOrder.indexOf(state.activeTileId);
        const next = tileOrder[(idx + 1) % tileOrder.length];
        selectTile(next, true);
      } else if (e.key === 'ArrowLeft') {
        const idx = tileOrder.indexOf(state.activeTileId);
        const prev = tileOrder[(idx - 1 + tileOrder.length) % tileOrder.length];
        selectTile(prev, true);
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        selectTile('welcome', true);
      }
    });

    // Toggle Reference PS5 <-> Live cr1mnsx Data
    dataModeBtn?.addEventListener('click', () => {
      playActSound();
      state.isLiveDataMode = !state.isLiveDataMode;
      applyDataMode();
    });

    // Trophies widget click toggles live PSN numbers or opens modal on double-click
    document.getElementById('widgetTrophies')?.addEventListener('click', () => {
      playActSound();
      state.isLiveDataMode = !state.isLiveDataMode;
      applyDataMode();
    });

    // Profile button & Game Hub buttons open Telemetry Modal
    document.getElementById('ps5ProfileBtn')?.addEventListener('click', () => openModal('psn'));
    document.getElementById('widgetFriends')?.addEventListener('click', () => openModal('psn'));
    document.getElementById('widgetStore')?.addEventListener('click', () => selectTile('store', true));
    document.getElementById('widgetWishlist')?.addEventListener('click', () => selectTile('store', true));
    document.getElementById('gameDetailPlayBtn')?.addEventListener('click', () => {
      openModal(state.activeTileId === 'brawlstars' ? 'brawl' : 'psn');
    });
    document.getElementById('actCard3')?.addEventListener('click', () => {
      openModal(state.activeTileId === 'brawlstars' ? 'brawl' : 'psn');
    });

    modalClose?.addEventListener('click', () => {
      playNavSound();
      modalBackdrop.hidden = true;
    });
    modalBackdrop?.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        playNavSound();
        modalBackdrop.hidden = true;
      }
    });
  }

  // --- Boot ---
  applyDataMode();
  initParticles();
  initEvents();
  loadTelemetry();
  setInterval(updateClock, 15000);
})();
