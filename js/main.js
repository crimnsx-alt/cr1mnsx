/**
 * PlayStation 5 System Software UI Logic — cr1mnsx
 * Navigation, Audio, Dynamic Hub Backdrop, Real PSN & Brawl Data
 */
(() => {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  // 1. Часы PS5 в правом верхнем углу (10:24 AM)
  const clockEl = $('#ps5Clock');
  const updateClock = () => {
    if (!clockEl) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    clockEl.textContent = `${hours}:${minutes} ${ampm}`;
  };
  updateClock();
  setInterval(updateClock, 1000);

  // 2. Аудио-система PS5 (оригинальные звуки navigation и activation из PS5ish)
  let audioCtx = null;
  const sfxBuffers = {};
  const sfxFiles = {
    nav: 'assets/audio/navigation.wav',
    act: 'assets/audio/activation.wav',
  };

  const initAudio = () => {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  };

  const preloadAudio = () => {
    initAudio();
    if (!audioCtx) return;
    Object.entries(sfxFiles).forEach(([key, url]) => {
      fetch(url)
        .then(res => res.arrayBuffer())
        .then(buf => audioCtx.decodeAudioData(buf))
        .then(decoded => { sfxBuffers[key] = decoded; })
        .catch(() => {});
    });
  };
  window.addEventListener('pointerdown', preloadAudio, { once: true });
  window.addEventListener('keydown', preloadAudio, { once: true });

  const playSfx = (type) => {
    initAudio();
    if (!audioCtx) return;
    const buffer = type === 'nav' ? sfxBuffers.nav : sfxBuffers.act;
    if (buffer) {
      try {
        const src = audioCtx.createBufferSource();
        const gain = audioCtx.createGain();
        src.buffer = buffer;
        gain.gain.value = type === 'nav' ? 0.35 : 0.45;
        src.connect(gain);
        gain.connect(audioCtx.destination);
        src.start(0);
        return;
      } catch {}
    }

    // Синтетический бекап на Web Audio API если файлы не успели загрузиться
    try {
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'nav') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(450, t + 0.05);
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.055);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1320, t + 0.06);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        osc.start(t);
        osc.stop(t + 0.17);
      }
    } catch {}
  };

  // 3. Частицы боке на фоне PS5
  const initBokehCanvas = () => {
    const canvas = $('#ps5Particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    });

    const particles = Array.from({ length: 35 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2.8 + 1,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(Math.random() * 0.35 + 0.15),
      alpha: Math.random() * 0.45 + 0.15,
      isGold: Math.random() > 0.4,
    }));

    const renderParticles = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.isGold
          ? `rgba(250, 204, 21, ${p.alpha})`
          : `rgba(56, 189, 248, ${p.alpha * 0.8})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.isGold ? '#facc15' : '#38bdf8';
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      requestAnimationFrame(renderParticles);
    };
    renderParticles();
  };
  initBokehCanvas();

  // 4. Переключение игр в горизонтальной ленте PS5
  const tiles = $$('.ps5-game-tile');
  const bgArt = $('#ps5BgArt');
  const welcomeView = $('#ps5WelcomeView');
  const detailView = $('#ps5GameDetailView');

  const detailTitle = $('#gameDetailTitle');
  const detailSub = $('#gameDetailSub');

  const selectTile = (tile) => {
    if (!tile) return;
    tiles.forEach(t => {
      t.classList.remove('is-focused');
      t.removeAttribute('aria-selected');
    });
    tile.classList.add('is-focused');
    tile.setAttribute('aria-selected', 'true');
    tile.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

    playSfx('nav');

    const gameId = tile.dataset.gameId;
    const banner = tile.dataset.banner;
    const title = tile.dataset.title;
    const sub = tile.dataset.sub;

    if (gameId === 'welcome' || gameId === 'store' || gameId === 'library') {
      // Режим Welcome Hub
      if (bgArt) {
        bgArt.classList.remove('is-active');
        bgArt.style.backgroundImage = '';
      }
      if (welcomeView) welcomeView.hidden = false;
      if (detailView) detailView.hidden = true;
    } else {
      // Режим конкретной игры (появляется Game Hub и арт игры)
      if (bgArt && banner) {
        bgArt.style.backgroundImage = `url("${banner}")`;
        bgArt.classList.add('is-active');
      }
      if (welcomeView) welcomeView.hidden = true;
      if (detailView) {
        detailView.hidden = false;
        if (detailTitle && title) detailTitle.textContent = title;
        if (detailSub && sub) detailSub.textContent = sub;
      }
    }
  };

  tiles.forEach((tile) => {
    tile.addEventListener('click', () => {
      selectTile(tile);
      playSfx('act');
    });
  });

  // 5. Клавиатурная навигация (Стрелки влево/вправо/Enter)
  window.addEventListener('keydown', (e) => {
    const curIdx = tiles.findIndex(t => t.classList.contains('is-focused'));
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIdx = Math.min(curIdx + 1, tiles.length - 1);
      selectTile(tiles[nextIdx]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIdx = Math.max(curIdx - 1, 0);
      selectTile(tiles[prevIdx]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      playSfx('act');
    }
  });

  // 6. Загрузка живой статистики PSN и Brawl Stars
  const loadLiveStats = async () => {
    try {
      const res = await fetch('data/psn_recent.json');
      if (res.ok) {
        const psn = await res.json();
        const acc = psn.account_summary;
        if (acc) {
          const tot = $('#trTotalVal');
          const lvl = $('#trLevelVal');
          const plat = $('#trPlatVal');
          const gold = $('#trGoldVal');
          const silver = $('#trSilverVal');
          const bronze = $('#trBronzeVal');
          const fill = $('#trProgressFill');
          const pct = $('#trLevelPct');

          if (tot) tot.textContent = acc.totalTrophies || 709;
          if (lvl) lvl.textContent = acc.trophyLevel || 199;
          if (pct) pct.textContent = `${acc.progress || 33}%`;
          if (fill) fill.style.width = `${acc.progress || 33}%`;

          const et = acc.earnedTrophies || {};
          if (plat) plat.textContent = et.platinum ?? 2;
          if (gold) gold.textContent = et.gold ?? 21;
          if (silver) silver.textContent = et.silver ?? 138;
          if (bronze) bronze.textContent = et.bronze ?? 548;
        }
      }
    } catch {}

    try {
      const bRes = await fetch('data/brawl.json');
      if (bRes.ok) {
        const bs = await bRes.json();
        const brawlTile = $('[data-game-id="brawl"]');
        if (brawlTile) {
          brawlTile.dataset.sub = `🏆 ${Number(bs.trophies || 40000).toLocaleString('ru-RU')} кубков · ${bs.brawlers || '108/108'} бойцов · ${bs.tag || '#2RGUQJQ0R'}`;
        }
      }
    } catch {}
  };
  loadLiveStats();

  // 7. Кнопки Games / Media
  const tabGames = $('#tabGames');
  const tabMedia = $('#tabMedia');
  if (tabGames && tabMedia) {
    tabGames.addEventListener('click', () => {
      tabGames.classList.add('is-active');
      tabMedia.classList.remove('is-active');
      playSfx('nav');
    });
    tabMedia.addEventListener('click', () => {
      tabMedia.classList.add('is-active');
      tabGames.classList.remove('is-active');
      playSfx('nav');
    });
  }
})();
