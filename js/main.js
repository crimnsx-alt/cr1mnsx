(() => {
  'use strict';

  /* ---------- Настройки ленты YouTube ----------
     Без ключа видео берутся из data/videos.json — обновить: node scripts/sync-youtube.mjs
     С ключом YouTube Data API v3 все видео канала подтягиваются с YouTube при каждом открытии.
     Ключ ограничьте по HTTP-referrer (адрес сайта) в Google Cloud Console. */
  const YOUTUBE = {
    apiKey: '',
    channelId: 'UCx4UpJ6nzW50T_Dg9MvhwLQ',
    channelUrl: 'https://www.youtube.com/@StriverDev',
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const root = document.documentElement;

  /* ---------- Счётчик уникальных визитов ---------- */
  const visitsEl = $('#visits');
  if (visitsEl) {
    fetch('/api/visit', { method: 'POST', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(({ visits }) => { visitsEl.textContent = Number(visits).toLocaleString('ru-RU'); })
      .catch(() => {
        let v = parseInt(localStorage.getItem('wivvi_visits') || '0', 10);
        if (!v) {
          v = 14320 + Math.floor(Math.random() * 80);
        }
        v += 1;
        localStorage.setItem('wivvi_visits', v);
        visitsEl.textContent = Number(v).toLocaleString('ru-RU');
      });
  }

  /* ---------- Фон: видео аквариума ---------- */
  const bgVideo = $('#bgVideo');
  if (bgVideo && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const small = matchMedia('(max-width: 900px)').matches || Boolean(navigator.connection && navigator.connection.saveData);
    // H.264 MP4 играет везде; на телефонах и при экономии трафика — лёгкая версия
    bgVideo.src = `assets/video/bg-${small ? '540p' : '720p'}.mp4`;
    bgVideo.muted = true;
    bgVideo.play().catch(() => {}); // если автозапуск запрещён, останется кадр-постер
    // браузер ставит фоновое видео на паузу, пока вкладка скрыта, — при возвращении продолжаем
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && bgVideo.paused) bgVideo.play().catch(() => {});
    });
  }

  /* ---------- XMB: ряд разделов и столбец пунктов ---------- */
  const xmb = $('#xmb');
  // разделы «только для ПК» (игра) на узком экране просто убираем из разметки
  if (innerWidth < 640) $$('[data-desktop]', xmb).forEach((section) => section.remove());
  const cats = $$('.cat', xmb);
  const viewer = $('#viewer');

  const catBar = document.createElement('div');
  catBar.className = 'xmb-cats';
  catBar.setAttribute('role', 'tablist');
  catBar.setAttribute('aria-label', 'Разделы');

  const catButtons = cats.map((cat, k) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xmb-cat';
    btn.id = `tab-${cat.id}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', cat.id);

    const icon = document.createElement('img');
    icon.src = cat.dataset.icon;
    icon.alt = '';
    const label = document.createElement('span');
    label.className = 'xmb-cat__label';
    label.textContent = $('.cat__label', cat).textContent;

    btn.append(icon, label);
    btn.addEventListener('click', () => {
      selectCat(k);
      btn.blur(); // иначе браузер рисует рамку фокуса при листании стрелками
    });
    catBar.append(btn);

    cat.setAttribute('role', 'tabpanel');
    cat.setAttribute('aria-labelledby', btn.id);
    return btn;
  });
  xmb.prepend(catBar);

  let current = 0;
  const selected = cats.map(() => 0); // PS3 помнит выбранный пункт в каждом разделе
  const itemsOf = (k) => $$('.cat__items > .item', cats[k]);

  let geo = null;
  const px = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;

  const measure = () => {
    const vw = innerWidth;
    const vh = innerHeight;
    const narrow = vw < 640;
    const catIcon = px('--cat-icon');
    const col = px('--col');
    const anchorX = narrow ? Math.max(16, vw * 0.08) : vw * 0.2;
    const catY = vh * (narrow ? 0.2 : 0.25);
    geo = {
      narrow,
      anchorX,
      catY,
      catIcon,
      // на телефоне кнопки не втискиваем все в экран: крайние уезжают вправо, как на ПК
      catStep: narrow ? Math.max(72, (vw - 32) / cats.length) : clamp(vw * 0.1, 112, 160),
      selY: catY + catIcon / 2 + 52,
      aboveBottom: catY - catIcon / 2 - 18,
      step: narrow ? 58 : Math.max(64, vh * 0.085),
    };
    root.style.setProperty('--ix', `${Math.max(8, anchorX + catIcon / 2 - col / 2)}px`);
  };

  const loadThumb = (item) => {
    const img = $('img[data-src]', item);
    if (!img) return;
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  };

  const render = () => {
    catButtons.forEach((btn, k) => {
      const on = k === current;
      // на телефоне ряд сдвигается, как на ПК, но выбранный раздел стоит во втором слоте,
      // чтобы предыдущая кнопка оставалась на экране и на неё можно было нажать
      const slot = Math.min(current, 1) + (k - current);
      const x = geo.narrow
        ? 16 + slot * geo.catStep + (geo.catStep - geo.catIcon) / 2
        : geo.anchorX + (k - current) * geo.catStep;
      btn.style.transform = `translate(${x}px, ${geo.catY - geo.catIcon / 2}px)`;
      btn.classList.toggle('is-current', on);
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
    });

    cats.forEach((cat, k) => {
      const on = k === current;
      cat.classList.toggle('is-current', on);
      const items = itemsOf(k);
      const s = clamp(selected[k], 0, Math.max(0, items.length - 1));
      selected[k] = s;
      items.forEach((item, j) => item.classList.toggle('is-selected', j === s));

      // скрытые разделы тоже раскладываем, чтобы при переключении пункты не прилетали сверху
      const selHeight = items[s] ? items[s].offsetHeight : 0;
      items.forEach((item, j) => {
        let y;
        if (j === s) y = geo.selY;
        else if (j > s) y = geo.selY + selHeight + 20 + (j - s - 1) * geo.step;
        else y = geo.aboveBottom - (s - j) * geo.step;
        item.style.transform = `translate3d(0, ${y}px, 0)`;
        const far = y < -geo.step * 2 || y > innerHeight + geo.step;
        item.classList.toggle('is-far', far);
        if (on && (!far || window.innerWidth <= 768)) loadThumb(item);
      });
    });

    // листаем пункты — на телефоне прячем термометр, чтобы не мешался
    root.classList.toggle('items-scrolled', selected[current] > 0);

    // Управление воспроизведением стрима в правой панели XMB
    const currentCatId = cats[current] ? cats[current].id : '';
    const mafanyaItem = $('#itemMafanyaTwitch');
    const isMafanyaSelected = currentCatId === 'twitch' && mafanyaItem && mafanyaItem.classList.contains('is-selected');
    if (isMafanyaSelected) {
      if (typeof loadTwitchXmbIframe === 'function') loadTwitchXmbIframe(true);
      if (typeof initAeroTilt === 'function') initAeroTilt();
    } else {
      if (typeof unloadTwitchXmbIframe === 'function') unloadTwitchXmbIframe();
    }
  };

  /* ---------- Аудио-эффекты PS3 XrossMediaBar (Web Audio API) ---------- */
  let soundEnabled = localStorage.getItem('ps3_sound') !== '0';
  let audioCtx = null;
  const soundToggleBtn = $('#soundToggle');

  function initAudio() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) audioCtx = new AudioCtxClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playSfx(type) {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'cat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, t);
        osc.frequency.exponentialRampToValueAtTime(650, t + 0.05);
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.055);
      } else if (type === 'item') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(750, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.04);
        gain.gain.setValueAtTime(0.035, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        osc.start(t);
        osc.stop(t + 0.045);
      } else if (type === 'ok') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1320, t + 0.05);
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.16);
      } else if (type === 'back') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.exponentialRampToValueAtTime(370, t + 0.06);
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        osc.start(t);
        osc.stop(t + 0.07);
      }
    } catch { /* ignore */ }
  }

  const updateSoundBtn = () => {
    if (!soundToggleBtn) return;
    soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
    soundToggleBtn.classList.toggle('is-muted', !soundEnabled);
    soundToggleBtn.title = soundEnabled ? 'Звук PS3: Включен (нажмите для выкл)' : 'Звук PS3: Выключен (нажмите для вкл)';
  };
  updateSoundBtn();

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      soundEnabled = !soundEnabled;
      localStorage.setItem('ps3_sound', soundEnabled ? '1' : '0');
      updateSoundBtn();
      if (soundEnabled) {
        initAudio();
        playSfx('ok');
      }
    });
  }

  /* ---------- Фоновая музыка: Dark Souls II — Majula Theme ---------- */
  const bgmAudio = $('#bgmAudio');
  const bgmPill = $('#bgmPill');
  const bgmToggleBtn = $('#bgmToggleBtn');
  const ps3Toast = $('#ps3Toast');
  const ps3ToastTitle = $('#ps3ToastTitle');
  const ps3ToastSub = $('#ps3ToastSub');
  const ds2PanelPlayBtn = $('#ds2PanelPlayBtn');
  const ds2SeekFill = $('#ds2SeekFill');
  const ds2SeekBar = $('#ds2SeekBar');
  const ds2TimeCurrent = $('#ds2TimeCurrent');

  if (bgmAudio) bgmAudio.volume = 0.5;

  let bgmPlaying = false;
  let toastTimer = null;

  const showPs3Toast = (title, sub) => {
    if (!ps3Toast) return;
    if (ps3ToastTitle && title) ps3ToastTitle.textContent = title;
    if (ps3ToastSub && sub) ps3ToastSub.textContent = sub;
    ps3Toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      ps3Toast.classList.remove('is-show');
    }, 4500);
  };

  const updateBgmUI = (isPlaying) => {
    bgmPlaying = isPlaying;
    if (bgmPill) {
      bgmPill.classList.toggle('is-playing', isPlaying);
    }
    if (ds2PanelPlayBtn) {
      const icon = $('.ds2-player-btn-icon', ds2PanelPlayBtn);
      const text = $('.ds2-player-btn-text', ds2PanelPlayBtn);
      if (icon) icon.textContent = isPlaying ? '⏸' : '▶';
      if (text) text.textContent = isPlaying ? 'Пауза' : 'Слушать';
    }
  };

  const playBgm = () => {
    if (!bgmAudio) return Promise.resolve(false);
    initAudio();
    bgmAudio.volume = 0.3;
    localStorage.removeItem('ps3_bgm_disabled');
    return bgmAudio.play().then(() => {
      updateBgmUI(true);
      showPs3Toast('Dark Souls II — Majula', 'Тема Маджулы · Motoi Sakuraba');
      removeAutoStartListeners();
      return true;
    }).catch((err) => {
      updateBgmUI(false);
      return false;
    });
  };

  const pauseBgm = () => {
    if (!bgmAudio) return;
    bgmAudio.pause();
    localStorage.setItem('ps3_bgm_disabled', '1');
    updateBgmUI(false);
  };

  const toggleBgm = () => {
    if (!bgmAudio) return;
    if (bgmAudio.paused) {
      playBgm();
      playSfx('ok');
    } else {
      pauseBgm();
      playSfx('back');
    }
  };

  if (bgmToggleBtn) {
    bgmToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBgm();
    });
  }

  if (ds2PanelPlayBtn) {
    ds2PanelPlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBgm();
    });
  }

  if (bgmAudio) {
    bgmAudio.addEventListener('timeupdate', () => {
      if (!bgmAudio.duration) return;
      const progress = (bgmAudio.currentTime / bgmAudio.duration) * 100;
      if (ds2SeekFill) ds2SeekFill.style.width = progress + '%';
      if (ds2TimeCurrent) {
        const curM = Math.floor(bgmAudio.currentTime / 60);
        const curS = Math.floor(bgmAudio.currentTime % 60).toString().padStart(2, '0');
        ds2TimeCurrent.textContent = `${curM}:${curS}`;
      }
    });

    bgmAudio.addEventListener('play', () => updateBgmUI(true));
    bgmAudio.addEventListener('pause', () => updateBgmUI(false));
    bgmAudio.addEventListener('ended', () => updateBgmUI(false));
  }

  if (ds2SeekBar) {
    ds2SeekBar.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!bgmAudio || !bgmAudio.duration) return;
      const rect = ds2SeekBar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      bgmAudio.currentTime = Math.max(0, Math.min(1, pos)) * bgmAudio.duration;
      if (bgmAudio.paused) playBgm();
    });
  }

  // Автоматический запуск фоновой темы при первом взаимодействии (громкость 30%):
  const gestureEvents = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'wheel', 'scroll', 'click'];
  const onUserGestureForBgm = () => {
    if (localStorage.getItem('ps3_bgm_disabled') === '1') {
      removeAutoStartListeners();
      return;
    }
    if (bgmAudio && bgmAudio.paused) {
      bgmAudio.volume = 0.3;
      bgmAudio.play().then(() => {
        updateBgmUI(true);
        showPs3Toast('Dark Souls II — Majula', 'Тема Маджулы · Motoi Sakuraba');
        removeAutoStartListeners();
      }).catch(() => {});
    }
  };

  const removeAutoStartListeners = () => {
    gestureEvents.forEach(evt => {
      window.removeEventListener(evt, onUserGestureForBgm, { capture: true });
      document.removeEventListener(evt, onUserGestureForBgm, { capture: true });
    });
  };

  function startBgmIfAllowed() {
    try {
      if (localStorage.getItem('ps3_bgm_disabled') !== '1') {
        gestureEvents.forEach(evt => {
          window.addEventListener(evt, onUserGestureForBgm, { capture: true, passive: true });
          document.addEventListener(evt, onUserGestureForBgm, { capture: true, passive: true });
        });
        playBgm();
      }
    } catch (e) {
      console.warn('BGM auto-start deferred:', e);
    }
  }

  function selectCat(k) {
    const next = clamp(k, 0, cats.length - 1);
    if (next === current) return;
    current = next;
    playSfx('cat');
    if (window.ps3WaveImpulse) window.ps3WaveImpulse();
    render();
    if (window.innerWidth <= 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      catButtons[current]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  function selectItem(j) {
    const items = itemsOf(current);
    const next = clamp(j, 0, items.length - 1);
    if (next === selected[current]) return;
    selected[current] = next;
    playSfx('item');
    if (window.ps3WaveImpulse) window.ps3WaveImpulse();
    render();
  }

  window.xmbGoto = (catIdx, itemIdx = 0) => {
    selectCat(catIdx);
    selectItem(itemIdx);
    if (window.innerWidth <= 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      catButtons[catIdx]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const activate = () => {
    const item = itemsOf(current)[selected[current]];
    if (!item) return;
    playSfx('ok');
    if (item.id === 'itemMafanyaTwitch' || item.classList.contains('item--mafanya')) {
      window.open('https://www.twitch.tv/mafanyaking', '_blank', 'noopener');
      return;
    }
    if (isMedia(item)) {
      openViewer(item);
      return;
    }
    const zoom = $('.item__zoom', item);
    if (zoom) {
      openViewer(zoom);
      return;
    }
    if (item.closest('#game')) {
      openGame($('.item__row', item).getAttribute('href'));
      return;
    }
    if (item.classList.contains('item--ds2') || item.id === 'itemDs2') {
      toggleBgm();
      return;
    }
    const row = $('.item__row', item);
    if (row && row.href) row.click();
  };

  /* клавиатура */
  addEventListener('keydown', (e) => {
    // пока открыта игра или просмотрщик, клавиши сайту не нужны
    if (!viewer.hidden || (play && !play.hidden) || e.altKey || e.ctrlKey || e.metaKey) return;
    const inPanel = e.target instanceof Element && e.target.closest('.item__panel');
    switch (e.key) {
      case 'ArrowLeft': selectCat(current - 1); break;
      case 'ArrowRight': selectCat(current + 1); break;
      case 'ArrowUp': selectItem(selected[current] - 1); break;
      case 'ArrowDown': selectItem(selected[current] + 1); break;
      case 'Home': selectItem(0); break;
      case 'End': selectItem(itemsOf(current).length - 1); break;
      case 'Enter':
      case ' ':
        if (inPanel) return;
        activate();
        break;
      default: return;
    }
    e.preventDefault();
  });

  /* мышь: клик выбирает пункт, повторный клик открывает */
  let swiped = false;
  xmb.addEventListener('click', (e) => {
    if (swiped) {
      e.preventDefault();
      swiped = false;
      return;
    }
    if (e.target.closest('.item__panel a') || e.target.closest('.item__panel button') || e.target.closest('.ds2-seek-bar')) return;
    // аватарка в «О себе» открывается в просмотрщике
    const zoom = e.target.closest('.cat.is-current .item.is-selected .item__zoom');
    if (zoom) {
      e.preventDefault();
      openViewer(zoom);
      return;
    }
    const item = e.target.closest('.cat.is-current .item');
    if (!item) return;
    const j = itemsOf(current).indexOf(item);
    if (j !== selected[current]) {
      e.preventDefault();
      selectItem(j);
      return;
    }
    if (item.classList.contains('item--ds2') || item.id === 'itemDs2') {
      e.preventDefault();
      toggleBgm();
      return;
    }
    if (item.id === 'itemMafanyaTwitch' || item.classList.contains('item--mafanya')) {
      return;
    }
    if (isMedia(item)) {
      e.preventDefault();
      openViewer(item);
      return;
    }
    // игру открываем поверх сайта, а не переходом по ссылке
    if (item.closest('#game')) {
      e.preventDefault();
      openGame($('.item__row', item).getAttribute('href'));
    }
  });

  /* колесо и тачпад: копим сдвиг, чтобы один жест не пролистывал десяток пунктов */
  let wheelAcc = 0;
  let wheelLast = 0;
  let wheelLockUntil = 0;
  addEventListener('wheel', (e) => {
    if (isTwitchDrawerOpen()) return;
    if (window.innerWidth <= 768) return; // Разрешаем нативный скролл на мобильных устройствах
    if (!viewer.hidden || (play && !play.hidden)) return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheelLast > 220) wheelAcc = 0;
    wheelLast = now;
    if (now < wheelLockUntil) return;

    const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
    wheelAcc += horizontal ? (e.deltaX || e.deltaY) : e.deltaY;
    if (Math.abs(wheelAcc) < 40) return;

    const dir = Math.sign(wheelAcc);
    wheelAcc = 0;
    if (horizontal) {
      selectCat(current + dir);
      wheelLockUntil = now + 260;
    } else {
      selectItem(selected[current] + dir);
      wheelLockUntil = now + 70;
    }
  }, { passive: false });

  /* свайпы на телефоне */
  let touchStart = null;
  xmb.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    touchStart = { x: e.clientX, y: e.clientY };
    swiped = false;
  });
  xmb.addEventListener('pointerup', (e) => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;
    if (window.innerWidth <= 768) {
      // На мобильных экранах не перехватываем вертикальный скролл контента!
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swiped = true;
        setTimeout(() => { swiped = false; }, 300);
        selectCat(current - Math.sign(dx));
      }
      return;
    }
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
    swiped = true;
    setTimeout(() => { swiped = false; }, 400);
    if (Math.abs(dx) > Math.abs(dy)) selectCat(current - Math.sign(dx));
    else selectItem(selected[current] - Math.sign(dy) * Math.max(1, Math.round(Math.abs(dy) / geo.step)));
  });
  xmb.addEventListener('pointercancel', () => { touchStart = null; });

  /* ---------- Просмотр фото и скейт-видео ---------- */
  const viewerImg = $('#viewerImg');
  const viewerVideo = $('#viewerVideo');
  const viewerCount = $('#viewerCount');
  const isMedia = (item) => item.classList.contains('item--photo') || item.classList.contains('item--clip');
  // ссылка на файл: у пунктов это строка пункта, у аватарки — она сама
  const linkOf = (el) => (el.matches('a[href]') ? el : $('.item__row', el));
  let viewerItems = [];
  let mediaIndex = 0;
  let lastFocus = null;
  let bgWasPlaying = false;

  const stopClip = () => {
    viewerVideo.pause();
    viewerVideo.removeAttribute('src');
    viewerVideo.load();
  };

  const showMedia = (i) => {
    mediaIndex = (i + viewerItems.length) % viewerItems.length;
    const item = viewerItems[mediaIndex];
    const row = linkOf(item);
    const clip = item.classList.contains('item--clip') || (row && row.href && row.href.includes('.mp4'));
    viewerImg.hidden = clip;
    viewerVideo.hidden = !clip;
    if (clip) {
      viewerImg.removeAttribute('src');
      const thumb = $('img', row) || $('video', row);
      viewerVideo.poster = thumb ? (thumb.poster || thumb.src || '') : '';
      viewerVideo.src = row.href;
      viewerVideo.play().catch(() => {});
    } else {
      stopClip();
      viewerImg.src = row.href;
      viewerImg.alt = $('img', row) ? $('img', row).alt : '';
    }
    viewerCount.textContent = `${mediaIndex + 1} / ${viewerItems.length}`;
    playSfx('item');
  };

  function openViewer(item) {
    lastFocus = document.activeElement;
    // аватарка открывается одна, фото и видео — вместе с остальными из раздела
    viewerItems = item.classList.contains('item__zoom') ? [item] : $$('.item--photo, .item--clip', item.closest('.cat'));
    viewer.classList.toggle('is-single', viewerItems.length < 2);
    // аквариум на фоне ставим на паузу, пока смотрят фото или видео
    bgWasPlaying = Boolean(bgVideo && !bgVideo.paused);
    if (bgWasPlaying) bgVideo.pause();
    viewer.hidden = false;
    showMedia(viewerItems.indexOf(item));
    $('[data-close]', viewer).focus();
  }

  const closeViewer = () => {
    playSfx('back');
    viewer.hidden = true;
    stopClip();
    if (bgWasPlaying) bgVideo.play().catch(() => {});
    const k = cats.findIndex((cat) => cat.contains(viewerItems[0]));
    const j = itemsOf(current).indexOf(viewerItems[mediaIndex]);
    if (k === current && j >= 0) {
      selected[current] = j;
      render();
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  viewer.addEventListener('click', (e) => {
    if (e.target.closest('[data-prev]')) showMedia(mediaIndex - 1);
    else if (e.target.closest('[data-next]')) showMedia(mediaIndex + 1);
    else if (e.target !== viewerImg && e.target !== viewerVideo) closeViewer();
  });

  addEventListener('keydown', (e) => {
    if (viewer.hidden) return;
    if (e.key === 'Escape' || e.key === 'Backspace') closeViewer();
    else if (e.key === 'ArrowLeft') showMedia(mediaIndex - 1);
    else if (e.key === 'ArrowRight') showMedia(mediaIndex + 1);
    else return;
    e.preventDefault();
  });

  // свайп листает, но не мешает перематывать видео на полосе управления
  let viewerTouch = null;
  viewer.addEventListener('pointerdown', (e) => { viewerTouch = e.target === viewerVideo ? null : e.clientX; });
  viewer.addEventListener('pointerup', (e) => {
    if (viewerTouch === null) return;
    const dx = e.clientX - viewerTouch;
    viewerTouch = null;
    if (Math.abs(dx) > 40) showMedia(mediaIndex - Math.sign(dx));
  });

  /* ---------- Игры: открываются поверх сайта, без новой вкладки ---------- */
  const play = $('#play');
  const playFrame = $('#playFrame');
  const playClose = $('#playClose');
  let playWasPlaying = false;

  // метка версии в адресе: иначе браузер может отдать старую копию страницы игры
  // вместе со старыми заголовками защиты, и кадр молча останется чёрным
  const GAME_BUILD = '2026-09-16';

  function openGame(url) {
    if (!play || !url) return;
    const finalUrl = url.startsWith('http') ? url : `${url}${url.includes('?') ? '&' : '?'}v=${GAME_BUILD}`;
    playFrame.src = finalUrl;
    play.hidden = false;
    // аквариум на фоне на паузу: игра и так грузит видеокарту
    playWasPlaying = Boolean(bgVideo && !bgVideo.paused);
    if (playWasPlaying) bgVideo.pause();
    // фокус отдаём самой игре, иначе стрелки уходят в разделы сайта под наложением
    playFrame.addEventListener('load', () => {
      try { playFrame.focus(); } catch { /* кадр мог быть уже закрыт */ }
    }, { once: true });
  }

  const closeGame = () => {
    playSfx('back');
    play.hidden = true;
    playFrame.removeAttribute('src'); // выгружаем игру, иначе она крутится в фоне
    if (playWasPlaying) bgVideo.play().catch(() => {});
  };

  if (play) {
    playClose.addEventListener('click', closeGame);
    addEventListener('keydown', (e) => {
      if (play.hidden || e.key !== 'Escape') return;
      closeGame();
      e.preventDefault();
    });
  }

  /* ---------- Ютуб видосы ---------- */
  const videoList = $('#videoItems');

  const fetchVideos = async () => {
    if (YOUTUBE.apiKey) {
      // плейлист «загрузки» канала, постранично по 50, пока не кончатся
      const videos = [];
      let pageToken = '';
      do {
        const params = new URLSearchParams({
          part: 'snippet,contentDetails',
          maxResults: '50',
          playlistId: YOUTUBE.channelId.replace(/^UC/, 'UU'),
          key: YOUTUBE.apiKey,
        });
        if (pageToken) params.set('pageToken', pageToken);
        const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`);
        if (!res.ok) throw new Error(`YouTube API: HTTP ${res.status}`);
        const data = await res.json();
        data.items.forEach(({ snippet, contentDetails }) => {
          if (snippet.title === 'Private video' || snippet.title === 'Deleted video') return;
          videos.push({
            id: snippet.resourceId.videoId,
            title: snippet.title,
            published: contentDetails.videoPublishedAt || snippet.publishedAt,
          });
        });
        pageToken = data.nextPageToken || '';
      } while (pageToken);
      return videos;
    }
    const res = await fetch('data/videos.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`videos.json: HTTP ${res.status}`);
    return (await res.json()).videos;
  };

  const makeItem = ({ href, iconClass, iconSrc, lazy, title, sub }) => {
    const li = document.createElement('li');
    li.className = 'item';

    const row = document.createElement('a');
    row.className = 'item__row';
    row.href = href;
    row.target = '_blank';
    row.rel = 'noopener';

    const icon = document.createElement('span');
    icon.className = `item__icon ${iconClass || ''}`.trim();
    const img = document.createElement('img');
    img.alt = '';
    if (lazy) img.dataset.src = iconSrc;
    else img.src = iconSrc;
    icon.append(img);

    const text = document.createElement('span');
    text.className = 'item__text';
    const titleEl = document.createElement('span');
    titleEl.className = 'item__title';
    titleEl.textContent = title;
    text.append(titleEl);
    if (sub) {
      const subEl = document.createElement('span');
      subEl.className = 'item__sub';
      subEl.textContent = sub;
      text.append(subEl);
    }

    row.append(icon, text);
    li.append(row);
    return li;
  };

  if (videoList) {
    fetchVideos()
      .then((videos) => {
        if (!videos.length) throw new Error('На канале пока нет видео');
        videoList.replaceChildren(...videos.map((video) => makeItem({
          href: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
          iconClass: 'item__icon--video',
          iconSrc: `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg`,
          lazy: true,
          title: video.title,
          sub: video.published
            ? new Date(video.published).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
            : '',
        })));
      })
      .catch((err) => {
        console.warn(err);
        const vidSection = $('#videos');
        if (vidSection) {
          videoList.replaceChildren(makeItem({
            href: YOUTUBE.channelUrl,
            iconSrc: vidSection.dataset.icon,
            title: 'Не получилось загрузить видео',
            sub: 'Смотреть на YouTube',
          }));
        }
      })
      .finally(() => { if (geo) render(); });
  }

  /* ---------- Запуск ---------- */
  root.classList.add('xmb-on', 'xmb-init');
  measure();
  render();
  const endInit = () => root.classList.remove('xmb-init');
  requestAnimationFrame(() => requestAnimationFrame(endInit));
  setTimeout(endInit, 500); // вкладка в фоне не отдаёт кадры

  addEventListener('resize', () => {
    measure();
    render();
  });
  if (document.fonts) document.fonts.ready.then(render);

  /* Клик по плашке посетителей в шапке ведёт сразу в категорию «Об этом сайте» к статистике */
  const visitorPill = $('#visitorPill');
  if (visitorPill) {
    visitorPill.style.cursor = 'pointer';
    visitorPill.addEventListener('click', (e) => {
      e.stopPropagation();
      const infoIdx = cats.findIndex(c => c.id === 'info');
      if (infoIdx !== -1) {
        window.xmbGoto(infoIdx, 0);
      }
    });
  }

  /* ---------- Brawl Stars: Синхронизация статистики с Brawlify (#2RGUQJQ0R) ---------- */
  const initBrawlStarsSync = () => {
    const TAG = '2RGUQJQ0R';
    const CACHE_KEY = 'bs_profile_2rguqjq0r_v3';
    const CACHE_TTL = 30 * 60 * 1000; // 30 минут

    const elTrophies = $('#bs-trophies');
    const elHighest = $('#bs-highest');
    const el3v3 = $('#bs-3v3');
    const elShowdown = $('#bs-showdown');
    const elBrawlers = $('#bs-brawlers');
    const elClub = $('#bs-club');
    const elSyncStatus = $('#bs-sync-status');
    const elSubPreview = $('#bs-sub-preview');

    const updateDOM = (data, isLive = false) => {
      if (!data) return;
      if (elTrophies && data.trophies) elTrophies.textContent = Number(data.trophies).toLocaleString('ru-RU');
      if (elHighest && (data.highest || data.highestTrophies)) {
        elHighest.textContent = Number(data.highest || data.highestTrophies).toLocaleString('ru-RU');
      }
      if (el3v3 && data.victories3v3) el3v3.textContent = Number(data.victories3v3).toLocaleString('ru-RU');
      if (elShowdown && data.showdown) {
        elShowdown.textContent = typeof data.showdown === 'number' ? Number(data.showdown).toLocaleString('ru-RU') : data.showdown;
      }
      if (elBrawlers && data.brawlers) elBrawlers.textContent = data.brawlers;
      if (elClub && data.club) elClub.textContent = data.club;
      if (elSubPreview && data.trophies) {
        elSubPreview.textContent = `🏆 ${Number(data.trophies).toLocaleString('ru-RU')} кубков · 3v3 победы · Ежедневный актив · brawlify.com`;
      }
      if (elSyncStatus) {
        elSyncStatus.textContent = isLive ? '🟢 Live с Brawlify' : '🟢 Синхронизировано';
      }
    };

    // Очистка старых версий кэша с заниженными кубками
    try {
      ['bs_profile_2rguqjq0r', 'bs_profile_2rguqjq0r_v2'].forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }

    // 1. Проверяем свежий кэш в localStorage
    let hasFreshCache = false;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.data?.trophies && parsed.data.trophies >= 35000) {
          updateDOM(parsed.data, false);
          if (Date.now() - parsed.timestamp < CACHE_TTL) {
            hasFreshCache = true;
          }
        }
      }
    } catch { /* ignore cache read error */ }

    // 2. Чтение локального JSON файла (assets/data/brawl.json или data/brawl.json)
    const loadLocalJson = async () => {
      const jsonPaths = ['assets/data/brawl.json', 'data/brawl.json'];
      for (const p of jsonPaths) {
        try {
          const resp = await fetch(p);
          if (resp.ok) {
            const raw = await resp.json();
            if (raw && raw.trophies && raw.trophies >= 35000) {
              const normalized = {
                trophies: raw.trophies,
                highest: raw.highestTrophies || raw.highest || raw.trophies,
                victories3v3: raw.victories3v3,
                showdown: raw.showdown || ((raw.soloVictories || 0) + (raw.duoVictories || 0)),
                brawlers: raw.brawlers || `${raw.brawlersUnlocked || 106} / ${raw.brawlersTotal || 108}`,
                club: raw.club || '0.3.7|teams'
              };
              updateDOM(normalized, false);
              try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ data: normalized, timestamp: Date.now() }));
              } catch { /* ignore */ }
              return true;
            }
          }
        } catch { /* ignore */ }
      }
      return false;
    };

    // 3. Парсер HTML страницы Brawlify
    const parseBrawlifyHTML = (html) => {
      if (!html || html.includes('Just a moment...') || html.includes('challenges.cloudflare.com')) {
        return null;
      }
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const textContent = doc.body.textContent || '';
        if (!textContent.includes(TAG)) return null;

        const res = {};
        const trophiesMatch = textContent.match(/Trophies[:\s]+([\d,]+)/i) || textContent.match(/([\d,]{4,6})\s*Trophies/i);
        if (trophiesMatch) res.trophies = parseInt(trophiesMatch[1].replace(/,/g, ''), 10);

        const highestMatch = textContent.match(/Highest[:\s]+([\d,]+)/i) || textContent.match(/Highest Trophies[:\s]+([\d,]+)/i);
        if (highestMatch) res.highest = parseInt(highestMatch[1].replace(/,/g, ''), 10);

        const v3Match = textContent.match(/3v3 Victories[:\s]+([\d,]+)/i) || textContent.match(/Victories[:\s]+([\d,]+)/i);
        if (v3Match) res.victories3v3 = parseInt(v3Match[1].replace(/,/g, ''), 10);

        const soloMatch = textContent.match(/Solo Victories[:\s]+([\d,]+)/i);
        const duoMatch = textContent.match(/Duo Victories[:\s]+([\d,]+)/i);
        if (soloMatch || duoMatch) {
          const s = soloMatch ? parseInt(soloMatch[1].replace(/,/g, ''), 10) : 0;
          const d = duoMatch ? parseInt(duoMatch[1].replace(/,/g, ''), 10) : 0;
          res.showdown = (s + d) || `${s} / ${d}`;
        }

        const brawlerMatch = textContent.match(/Brawlers[:\s]+(\d+)\s*\/\s*(\d+)/i) || textContent.match(/(\d+)\s*\/\s*(\d+)\s*Brawlers/i);
        if (brawlerMatch) res.brawlers = `${brawlerMatch[1]} / ${brawlerMatch[2]}`;

        const clubMatch = doc.querySelector('.club-name, [class*="club"]') || textContent.match(/Club[:\s]+([^\n\r]+)/i);
        if (clubMatch) {
          res.club = (clubMatch.textContent || clubMatch[1] || '').trim().replace(/Club:?/i, '').trim();
        }

        // Защита от старых или битых данных: трофеи должны быть не ниже 35000
        return (res.trophies && res.trophies >= 35000) ? res : null;
      } catch {
        return null;
      }
    };

    // 4. Онлайн обновление через CORS-прокси (только если нет свежего кэша)
    const fetchOnline = async () => {
      const loaded = await loadLocalJson();
      if (hasFreshCache && loaded) return;

      const targetUrl = `https://brawlify.com/player/${TAG}`;
      const proxyList = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
      ];

      for (const pUrl of proxyList) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const resp = await fetch(pUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (resp.ok) {
            const html = await resp.text();
            const data = parseBrawlifyHTML(html);
            if (data && data.trophies >= 35000) {
              updateDOM(data, true);
              try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
              } catch { /* ignore */ }
              return;
            }
          }
        } catch {
          // тихо пропускаем таймауты
        }
      }
    };

    fetchOnline();
  };

  /* ---------- PlayStation 5: Синхронизация последней запущенной игры ---------- */
  const initPS5LastPlayedSync = () => {
    const PSN_USER = 'Cr1mnsx';
    const CACHE_KEY = 'ps5_last_played_cr1mnsx_v2';

    const elTitles = $$('.ps5-last-game-title');
    const elImgs = $$('.ps5-last-game-img');
    const elPlatforms = $$('.ps5-last-game-platform');
    const elStatuses = $$('.ps5-last-game-status');
    const elProgresses = $$('.ps5-last-game-progress');
    const elBars = $$('.ps5-last-game-bar');

    const updateDOM = (game) => {
      if (!game || !game.title) return;

      const title = game.title;
      const imgUrl = game.image || game.thumb || game.banner;
      const platform = game.platform || 'PS5';
      const pct = game.progress_percent !== undefined ? Math.min(100, Math.max(0, Number(game.progress_percent))) : 0;
      const earned = game.trophies_earned !== undefined ? Number(game.trophies_earned) : 0;
      const total = game.trophies_total !== undefined ? Number(game.trophies_total) : 0;
      const rank = game.rank || 'D';
      const lastPlayedText = game.last_played_text || game.last_played || '29 сентября 2026';
      const isPlaying = !!game.is_playing_now;

      // 1. Шапка: кнопка-плашка PS5
      const topPillText = $('#ps5TopPillText');
      const topPillDot = $('#ps5TopPillDot');
      if (topPillText) {
        topPillText.textContent = isPlaying ? `🟢 В игре: ${title}` : `PS5: ${title}`;
      }
      if (topPillDot) {
        topPillDot.classList.toggle('is-playing', isPlaying);
      }

      // 2. Подзаголовок элемента PlayStation Network в меню игр
      const psnSub = $('#psnHeaderSub');
      if (psnSub) {
        psnSub.textContent = isPlaying
          ? `🟢 В игре прямо сейчас на PS5: ${title}`
          : `🎮 Последний запуск: ${title} (${lastPlayedText}) · 647 трофеев`;
      }

      // 3. Отдельный пункт в списке игр: #itemPs5Latest
      const latestItem = $('#itemPs5Latest');
      if (latestItem) {
        const t = $('.ps5-latest-title', latestItem);
        if (t) t.textContent = title;

        const sub = $('.ps5-latest-sub', latestItem);
        if (sub) {
          sub.textContent = isPlaying
            ? `🟢 В игре прямо сейчас на PS5 · ${pct}% трофеев`
            : `🎮 Последний запуск на PS5 · ${lastPlayedText} · ${pct}% трофеев`;
        }

        const thumb = $('.ps5-latest-thumb', latestItem);
        if (thumb && imgUrl) {
          thumb.src = imgUrl;
          thumb.alt = title;
        }

        const banner = $('.ps5-latest-banner', latestItem);
        if (banner && imgUrl) {
          banner.src = imgUrl;
          banner.alt = title;
        }

        const bannerBg = $('.game-banner-bg', latestItem);
        if (bannerBg && imgUrl) {
          bannerBg.src = imgUrl;
        }

        const overlayTag = $('.ps5-latest-overlay-tag', latestItem);
        if (overlayTag) {
          overlayTag.textContent = isPlaying ? '🟢 СЕЙЧАС В ИГРЕ · PLAYSTATION 5' : 'PLAYSTATION 5 · ПОСЛЕДНИЙ ЗАПУСК';
        }

        const badge = $('.ps5-latest-badge', latestItem);
        if (badge) {
          badge.textContent = isPlaying ? '🟢 В игре' : 'Последний запуск';
        }

        const plat = $('.ps5-latest-platform', latestItem);
        if (plat) plat.textContent = platform;

        const note = $('.ps5-latest-note', latestItem);
        if (note) {
          note.textContent = isPlaying
            ? `Прямо сейчас запущено на консоли PlayStation 5. Прогресс трофеев: ${pct}% (${earned}/${total}).`
            : `Запущено на консоли PlayStation 5. Дата запуска: ${lastPlayedText}. Прогресс трофеев: ${pct}% (${earned}/${total}).`;
        }

        const progPill = $('.ps5-latest-progress-pill', latestItem);
        if (progPill) {
          progPill.innerHTML = `<span class="stat-trophy">🏆</span> <b>${pct}%</b> трофеев (${earned}/${total})`;
        }

        const rankPill = $('.ps5-latest-rank-pill', latestItem);
        if (rankPill) {
          rankPill.innerHTML = `<span class="stat-star">⭐</span> <b>${rank}</b> Rank`;
        }

        const datePill = $('.ps5-latest-date-pill', latestItem);
        if (datePill) {
          datePill.innerHTML = `<span class="stat-star">⏱️</span> <b>${lastPlayedText}</b>`;
        }
      }

      // 4. Обновление всех общих виджетов (карточка в профиле #cr1mnsx и виджет в панели PSN)
      elTitles.forEach(el => { el.textContent = title; });
      if (imgUrl) {
        elImgs.forEach(el => {
          el.src = imgUrl;
          el.alt = title;
        });
      }
      elPlatforms.forEach(el => { el.textContent = platform; });
      elStatuses.forEach(el => {
        if (isPlaying) {
          el.innerHTML = '<span style="color:#4ade80; font-weight:700;">🟢 В ИГРЕ СЕЙЧАС НА PLAYSTATION 5</span>';
        } else {
          el.textContent = `Последний запуск на PlayStation 5 · ${lastPlayedText}`;
        }
      });
      elBars.forEach(el => { el.style.width = `${pct}%`; });
      const extraRank = rank ? ` · ${rank} Rank` : '';
      const progressStr = (earned > 0 && total > 0)
        ? `🏆 ${earned}/${total} трофеев (${pct}%)${extraRank}`
        : `🏆 Прогресс: ${pct}%${extraRank}`;
      elProgresses.forEach(el => { el.textContent = progressStr; });
    };

    // Клик по плашке в шапке переносит в категорию Games к последней игре
    const topPill = $('#ps5TopPill');
    if (topPill) {
      topPill.addEventListener('click', () => {
        if (window.xmbGoto) window.xmbGoto(1, 1);
      });
    }

    // Автоматическое создание красивого эмбиент-фона для всех баннеров игр
    const initAmbientGameBanners = () => {
      $$('.game-banner-link').forEach(link => {
        const img = $('img.game-banner-img', link);
        if (img && !$('.game-banner-bg', link) && !img.src.includes('brawl-stars-banner') && !img.src.includes('ds2-majula') && !img.src.includes('terminal')) {
          const bg = document.createElement('img');
          bg.className = 'game-banner-bg';
          bg.src = img.src;
          bg.alt = '';
          bg.setAttribute('aria-hidden', 'true');
          link.prepend(bg);
        }
      });
    };
    initAmbientGameBanners();

    // 1. Быстро отображаем сохраненный кэш, если он есть
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data } = JSON.parse(cached);
        if (data) updateDOM(data);
      }
    } catch {}

    // 2. Проверяем локальные JSON с данными PSN игр (с обходом HTTP-кэша)
    const loadLocalPSN = async () => {
      const endpoints = ['data/psn_recent.json', 'data/psn_games.json', 'assets/data/psn_games.json'];
      for (const ep of endpoints) {
        try {
          const res = await fetch(`${ep}?_=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            let rawGame = null;
            let isPlayingNow = false;

            if (json && typeof json === 'object') {
              if (Array.isArray(json)) {
                rawGame = json[0];
                isPlayingNow = rawGame?.status?.includes('Играет прямо сейчас') || false;
              } else {
                rawGame = json.game || json.last_played || (Array.isArray(json.games) ? json.games[0] : null);
                isPlayingNow = json.is_playing_now !== undefined ? !!json.is_playing_now : (rawGame?.status?.includes('Играет прямо сейчас') || false);
              }
            }

            if (rawGame && rawGame.title) {
              const game = {
                title: rawGame.title,
                image: rawGame.image || rawGame.thumb || rawGame.banner,
                platform: rawGame.platform || 'PS5',
                progress_percent: rawGame.progress_percent !== undefined ? rawGame.progress_percent : (rawGame.progress_pct !== undefined ? rawGame.progress_pct : 0),
                trophies_earned: rawGame.trophies_earned !== undefined ? rawGame.trophies_earned : (rawGame.trophy_breakdown ? (rawGame.trophy_breakdown.bronze + rawGame.trophy_breakdown.silver + rawGame.trophy_breakdown.gold + rawGame.trophy_breakdown.platinum) : 0),
                trophies_total: rawGame.trophies_total !== undefined ? rawGame.trophies_total : 0,
                rank: rawGame.rank || 'D',
                last_played_text: rawGame.last_played_text || rawGame.last_played || '29 сентября 2026',
                is_playing_now: isPlayingNow
              };

              updateDOM(game);
              try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ data: game, timestamp: Date.now() }));
              } catch {}
              return true;
            }
          }
        } catch {}
      }
      return false;
    };

    // Запускаем немедленно и ставим периодический опрос каждые 30 секунд
    loadLocalPSN();
    setInterval(loadLocalPSN, 30000);

    // 3. Fallback: парсинг профиля через CORS-прокси (только если локальные файлы недоступны)
    const targetUrl = `https://psn.gg/profile/${PSN_USER}`;
    const proxyList = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
    ];

    const fetchViaProxies = async () => {
      // Запускаем только если loadLocalPSN не дал результата
      const loaded = await loadLocalPSN();
      if (loaded) return;

      for (const pUrl of proxyList) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const resp = await fetch(pUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (resp.ok) {
            const html = await resp.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const gameRow = doc.querySelector('.game-row, .library-item, #gamesTable tr, tr.game');
            if (!gameRow) continue;

            const titleEl = gameRow.querySelector('.title, .game-title, a[href*="/game/"]');
            const imgEl = gameRow.querySelector('img.game, img.cover, img');
            if (titleEl) {
              const gameData = {
                title: titleEl.textContent.trim(),
                image: imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : '',
                platform: 'PS5',
                last_played_text: 'Недавно'
              };
              updateDOM(gameData);
              return;
            }
          }
        } catch {}
      }
    };

    fetchViaProxies();
  };

  /* ==================================================
     1. 3D-НАКЛОН КАРТОЧЕК ПРИ НАВЕДЕНИИ (AERO GLASS TILT)
     ================================================== */
  function initAeroTilt() {
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!canHover) return;

    const selector = '.aero-tilt, .pgc-card, .game-banner-widget, .kpi-card, .bs-profile-card, .twitch-quicklink, .twitch-drawer__player-wrap';
    const cards = $$(selector);

    cards.forEach(card => {
      if (card.__tiltInitialized) return;
      card.__tiltInitialized = true;

      let rafId = null;
      let targetRotX = 0;
      let targetRotY = 0;
      let targetGlareX = 50;
      let targetGlareY = 50;
      let isOver = false;

      const renderTilt = () => {
        if (!isOver) return;
        card.style.setProperty('--rotate-x', `${targetRotX}deg`);
        card.style.setProperty('--rotate-y', `${targetRotY}deg`);
        card.style.setProperty('--glare-x', `${targetGlareX}%`);
        card.style.setProperty('--glare-y', `${targetGlareY}%`);
        rafId = null;
      };

      card.addEventListener('mouseenter', () => {
        isOver = true;
        card.classList.add('is-tilting');
      });

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Нормализованные координаты: от -1 до +1
        const nx = (x / rect.width) * 2 - 1;
        const ny = (y / rect.height) * 2 - 1;

        // Физический наклон от -8° до +8°
        targetRotX = (-ny * 8).toFixed(2);
        targetRotY = (nx * 8).toFixed(2);

        // Положение динамического блика в процентах
        targetGlareX = ((x / rect.width) * 100).toFixed(1);
        targetGlareY = ((y / rect.height) * 100).toFixed(1);

        if (!rafId) {
          rafId = requestAnimationFrame(renderTilt);
        }
      });

      card.addEventListener('mouseleave', () => {
        isOver = false;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        card.classList.remove('is-tilting');
        card.style.setProperty('--rotate-x', '0deg');
        card.style.setProperty('--rotate-y', '0deg');
        card.style.setProperty('--glare-x', '50%');
        card.style.setProperty('--glare-y', '50%');
      });
    });
  }

  /* ==================================================
     2. ПРАВАЯ ПАНЕЛЬ СТРИМА МАФАНИ (XMB WIDGET)
     ================================================== */
  function loadTwitchXmbIframe(autoplay = true) {
    const iframe = $('#twitchXmbIframe');
    if (!iframe) return;
    const currentHost = window.location.hostname || 'crimnsx-alt.github.io';
    const hosts = ['crimnsx-alt.github.io', 'localhost', '127.0.0.1'];
    if (!hosts.includes(currentHost) && currentHost) hosts.push(currentHost);
    const parentQuery = hosts.map(h => `parent=${encodeURIComponent(h)}`).join('&');
    const targetSrc = `https://player.twitch.tv/?channel=mafanyaking&${parentQuery}&muted=false&autoplay=${autoplay ? 'true' : 'false'}`;
    if (iframe.src !== targetSrc) {
      iframe.src = targetSrc;
    }
  }

  function unloadTwitchXmbIframe() {
    const iframe = $('#twitchXmbIframe');
    if (iframe && iframe.src) {
      iframe.src = '';
    }
  }

  function updateTwitchUI(info) {
    const statusPill = $('#twitchXmbStatusPill');
    const statusLabel = $('#twitchXmbStatusLabel');
    const topPill = $('#twitchTopPill');
    const topPillDot = $('#twitchTopPillDot');
    const topPillText = $('#twitchTopPillText');
    const menuBadge = $('#mafanyaMenuBadge');
    const avatarEl = $('#twitchXmbAvatar');
    const subEl = $('#twitchXmbSub');
    const titleEl = $('#twitchXmbStreamTitle');
    const catEl = $('#twitchXmbCategory');
    const viewersEl = $('#twitchXmbViewers');
    const uptimeEl = $('#twitchXmbUptime');

    if (info.followers && subEl) {
      const k = Math.round(info.followers / 1000);
      subEl.textContent = `mafanyaking · ${k}k фолловеров`;
    }
    if (info.avatar && avatarEl && !avatarEl.src.includes(info.avatar)) {
      avatarEl.src = info.avatar;
    }

    if (info.isLive) {
      if (statusPill) {
        statusPill.classList.remove('is-offline');
        statusPill.classList.add('is-live');
      }
      if (statusLabel) statusLabel.textContent = '🔴 В ЭФИРЕ';
      if (topPillDot) topPillDot.classList.add('is-live');
      if (topPillText) topPillText.textContent = 'Мафаня 🔴 LIVE';
      if (menuBadge) menuBadge.style.display = 'inline-flex';

      if (titleEl && info.title) titleEl.textContent = info.title;
      if (catEl && info.game) catEl.textContent = `🎮 ${info.game}`;
      if (viewersEl && info.viewers) viewersEl.textContent = `👥 ${Number(info.viewers).toLocaleString('ru-RU')} зрителей`;
      if (uptimeEl && info.uptime) {
        uptimeEl.style.display = 'inline-flex';
        uptimeEl.textContent = `⏱ ${info.uptime}`;
      }
    } else {
      if (statusPill) {
        statusPill.classList.remove('is-live');
        statusPill.classList.add('is-offline');
      }
      if (statusLabel) statusLabel.textContent = '⚪ ОФФЛАЙН';
      if (topPillDot) topPillDot.classList.remove('is-live');
      if (topPillText) topPillText.textContent = 'Мафаня';
      if (menuBadge) menuBadge.style.display = 'none';

      if (titleEl) {
        titleEl.textContent = info.lastBroadcastTitle 
          ? `Последний стрим: «${info.lastBroadcastTitle}»` 
          : 'Канал Влада Мафани на Twitch';
      }
      if (catEl) catEl.textContent = '🎮 Общение';
      if (viewersEl) viewersEl.textContent = '👥 Оффлайн';
      if (uptimeEl) uptimeEl.style.display = 'none';
    }
  }

  async function checkTwitchLiveStatus() {
    try {
      const res = await fetch('https://api.ivr.fi/v2/twitch/user?login=mafanyaking', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const user = Array.isArray(data) ? data[0] : data;
        if (user) {
          const isLive = Boolean(user.stream);
          updateTwitchUI({
            isLive,
            title: user.stream?.title || user.lastBroadcast?.title || 'Стрим Влада Мафани',
            lastBroadcastTitle: user.lastBroadcast?.title,
            viewers: user.stream?.viewersCount || 0,
            game: user.stream?.game?.displayName || 'Just Chatting',
            followers: user.followers,
            avatar: user.logo || 'assets/photos/twitch/mafanya.png'
          });
          return;
        }
      }
    } catch {}

    try {
      const res2 = await fetch('https://decapi.me/twitch/uptime/mafanyaking', { cache: 'no-store' });
      if (res2.ok) {
        const text = await res2.text();
        const isOffline = text.toLowerCase().includes('offline');
        updateTwitchUI({
          isLive: !isOffline,
          title: !isOffline ? 'Прямой эфир Влада' : 'Стрим сейчас не идет',
          uptime: !isOffline ? text.trim() : null
        });
        return;
      }
    } catch {}

    updateTwitchUI({ isLive: false });
  }

  function initTwitchXmbWidget() {
    const topPill = $('#twitchTopPill');
    if (topPill) {
      topPill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const twitchCatIdx = cats.findIndex(c => c.id === 'twitch');
        if (twitchCatIdx !== -1) {
          window.xmbGoto(twitchCatIdx, 1);
          playSfx('ok');
        }
      });
    }

    // Первичная проверка статуса стрима и периодический опрос раз в 60 сек
    checkTwitchLiveStatus();
    setInterval(checkTwitchLiveStatus, 60000);
  }

  startBgmIfAllowed();
  initBrawlStarsSync();
  initPS5LastPlayedSync();
  initAeroTilt();
  initTwitchXmbWidget();
})();
