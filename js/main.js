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

  /* ---------- Фон: видео аквариума (отключено в пользу лёгкого Canvas 60fps) ---------- */
  const bgVideo = $('#bgVideo');
  if (bgVideo) {
    bgVideo.pause();
    bgVideo.removeAttribute('src');
    bgVideo.style.display = 'none';
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

  /* Twitch State */
  let activeTwitchTab = 'clips';
  let twitchIsLiveNow = false;
  let currentClipIndex = 0;
  let currentClipsList = [];

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
      if (typeof onMafanyaSelected === 'function') onMafanyaSelected();
      else if (typeof loadTwitchXmbIframe === 'function') loadTwitchXmbIframe(true);
    } else {
      if (typeof onMafanyaDeselected === 'function') onMafanyaDeselected();
      else if (typeof unloadTwitchXmbIframe === 'function') unloadTwitchXmbIframe();
    }

    // Управление воспроизведением видео-превью игр MinGame при навигации в XMB
    if (currentCatId === 'game') {
      const selectedGameItem = itemsOf(current)[selected[current]];
      const allGameVideos = $$('#game .game-banner-video');
      allGameVideos.forEach((v) => { if (!v.paused) v.pause(); });
      if (selectedGameItem) {
        const v = selectedGameItem.querySelector('.game-banner-video');
        if (v && (v.currentSrc || v.querySelector('source[src]'))) {
          v.classList.add('has-video');
          v.play().catch(() => {});
        }
      }
    } else {
      const allGameVideos = $$('#game .game-banner-video');
      allGameVideos.forEach((v) => { if (!v.paused) v.pause(); });
    }

    if (typeof initAeroTilt === 'function') initAeroTilt();
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
      } else if (type === 'trophy') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, t);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.36);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.5, t + 0.08);
        gain2.gain.setValueAtTime(0.09, t + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(t + 0.08);
        osc2.stop(t + 1.25);
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

  /* ---------- PS3 Notification Toast ---------- */
  const ps3Toast = $('#ps3Toast');
  const ps3ToastTitle = $('#ps3ToastTitle');
  const ps3ToastSub = $('#ps3ToastSub');
  let toastTimer = null;

  const ps3ToastIcon = ps3Toast ? ps3Toast.querySelector('.ps3-toast__icon') : null;
  const showPs3Toast = (title, sub, iconHtml) => {
    if (!ps3Toast) return;
    if (ps3ToastTitle && title) ps3ToastTitle.textContent = title;
    if (ps3ToastSub && sub) ps3ToastSub.textContent = sub;
    if (ps3ToastIcon) {
      if (iconHtml) ps3ToastIcon.innerHTML = iconHtml;
      else ps3ToastIcon.innerHTML = '🎮';
    }
    ps3Toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      ps3Toast.classList.remove('is-show');
    }, 4500);
  };
  window.showPs3Toast = showPs3Toast;

  function selectCat(k) {
    if (typeof k === 'string') {
      const idx = cats.findIndex(c => c.id === k);
      if (idx !== -1) k = idx;
    }
    const next = clamp(k, 0, cats.length - 1);
    if (next === current) return;
    current = next;
    playSfx('cat');
    // Trophy hook for categories visited
    if (window.trackCatVisit) window.trackCatVisit(next);

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
    // Trophy hook for bio / gaming showcase
    if (window.checkNavTrophy) window.checkNavTrophy(current, next);

    if (window.ps3WaveImpulse) window.ps3WaveImpulse();
    render();
  }

  window.xmbGoto = (catTarget, itemIdx = 0) => {
    let catIdx = catTarget;
    if (typeof catTarget === 'string') {
      const idx = cats.findIndex(c => c.id === catTarget);
      if (idx !== -1) catIdx = idx;
      else catIdx = 0;
    }
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
    if (typeof window.ps3ParticleBurst === 'function') {
      const rect = item.getBoundingClientRect();
      window.ps3ParticleBurst(rect.left + Math.min(rect.width / 2, 80), rect.top + rect.height / 2, 22);
    }
    if (item.id === 'itemMafanyaTwitch' || item.classList.contains('item--mafanya')) {
      window.open('https://www.twitch.tv/mafanyaking', '_blank', 'noopener');
      return;
    }
    if (item.closest('#cr1mnsx')) {
      return;
    }
    if (isMedia(item)) {
      openViewer(item);
      return;
    }
    if (item.closest('#game')) {
      const row = $('.item__row', item);
      const url = row.getAttribute('data-game-url') || row.getAttribute('href');
      const title = row.getAttribute('data-game-title') || $('.item__title', item)?.textContent || 'Игра';
      openGame(url, title);
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
      const row = $('.item__row', item);
      const url = row.getAttribute('data-game-url') || row.getAttribute('href');
      const title = row.getAttribute('data-game-title') || $('.item__title', item)?.textContent || 'Игра';
      openGame(url, title);
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
    viewerItems = $$('.item--photo, .item--clip', item.closest('.cat'));
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

  /* ---------- Игры: открываются поверх сайта в красивом PS3 Theater окне ---------- */
  const play = $('#play');
  const playWindow = $('#playWindow');
  const playStage = $('#playStage');
  const playFrame = $('#playFrame');
  const playClose = $('#playClose');
  const playBackdrop = $('#playBackdrop');
  const playTitle = $('#playGameTitle');
  const playFsBtn = $('#playFullscreenBtn');
  const playFsIcon = $('#playFsIcon');
  const playFsLabel = $('#playFsLabel');
  const playLoader = $('#playLoader');
  const playFallbackBtn = $('#playFallbackBtn');
  let playWasPlaying = false;
  let playFallbackTimer = null;
  let currentActiveGameUrl = '';

  const GAME_BUILD = '2026-10-30';

  function openGame(url, title = 'Игра') {
    if (!play || !url || url === '#play') return;
    currentActiveGameUrl = url;

    if (playTitle) playTitle.textContent = title;
    if (playLoader) {
      playLoader.style.display = 'flex';
      playLoader.style.opacity = '1';
    }
    if (playFallbackBtn) playFallbackBtn.style.display = 'none';

    const finalUrl = url.startsWith('http') ? url : `${url}${url.includes('?') ? '&' : '?'}v=${GAME_BUILD}`;
    playFrame.src = finalUrl;
    play.hidden = false;

    // аквариум на фоне на паузу: игра и так грузит видеокарту
    playWasPlaying = Boolean(bgVideo && !bgVideo.paused);
    if (playWasPlaying) bgVideo.pause();

    // Таймаут для показа альтернативной кнопки если фрейм блокируется
    clearTimeout(playFallbackTimer);
    playFallbackTimer = setTimeout(() => {
      if (playLoader && playLoader.style.display !== 'none' && playFallbackBtn) {
        playFallbackBtn.style.display = 'inline-block';
      }
    }, 4500);

    // фокус отдаём самой игре, иначе стрелки уходят в разделы сайта под наложением
    playFrame.addEventListener('load', () => {
      clearTimeout(playFallbackTimer);
      if (playLoader) {
        playLoader.style.opacity = '0';
        setTimeout(() => { if (playLoader) playLoader.style.display = 'none'; }, 280);
      }
      try { playFrame.focus(); } catch { /* кадр мог быть уже закрыт */ }
    }, { once: true });
  }

  function toggleFullscreen() {
    const target = playWindow || playStage || play;
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(() => {
          if (play.requestFullscreen) play.requestFullscreen().catch(() => {});
        });
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  function updateFsUI() {
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (playWindow) playWindow.classList.toggle('is-fullscreen', isFs);
    if (playFsIcon) playFsIcon.textContent = isFs ? '🗗' : '⛶';
    if (playFsLabel) playFsLabel.textContent = isFs ? 'В окно' : 'Во весь экран';
  }

  const closeGame = () => {
    playSfx('back');
    clearTimeout(playFallbackTimer);
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (isFs) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
    play.hidden = true;
    playFrame.removeAttribute('src'); // выгружаем игру, чтобы остановить звук
    if (playLoader) {
      playLoader.style.display = 'flex';
      playLoader.style.opacity = '1';
    }
    if (playFallbackBtn) playFallbackBtn.style.display = 'none';
    if (playWasPlaying && bgVideo) bgVideo.play().catch(() => {});
  };

  if (play) {
    if (playClose) playClose.addEventListener('click', closeGame);
    if (playBackdrop) playBackdrop.addEventListener('click', closeGame);
    if (playFsBtn) playFsBtn.addEventListener('click', toggleFullscreen);

    if (playFallbackBtn) {
      playFallbackBtn.addEventListener('click', () => {
        if (currentActiveGameUrl) {
          window.open(currentActiveGameUrl, '_blank', 'popup=yes,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
        }
      });
    }

    document.addEventListener('fullscreenchange', updateFsUI);
    document.addEventListener('webkitfullscreenchange', updateFsUI);

    addEventListener('keydown', (e) => {
      if (play.hidden || e.key !== 'Escape') return;
      closeGame();
      e.preventDefault();
    });
  }

  // Делегирование кликов по кнопкам запуска игр в карточках
  document.addEventListener('click', (e) => {
    const fsBtn = e.target.closest('.game-window__fs-btn');
    if (fsBtn) {
      e.preventDefault();
      e.stopPropagation();
      const url = fsBtn.getAttribute('data-game-url');
      const title = fsBtn.getAttribute('data-game-title') || 'Игра';
      if (url) {
        openGame(url, title);
        setTimeout(() => toggleFullscreen(), 120);
      }
      return;
    }

    const btn = e.target.closest('.psn-btn-launch-game, .game-banner-link[data-game-url], .game-window__screen[data-game-url]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const url = btn.getAttribute('data-game-url');
      const title = btn.getAttribute('data-game-title') || 'Игра';
      if (url) openGame(url, title);
    }
  });

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

  const handleHash = () => {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return;
    const [hCat, hItem] = raw.split(':');
    const catIdx = cats.findIndex(c => c.id === hCat);
    if (catIdx !== -1) {
      window.xmbGoto(catIdx, hItem !== undefined ? parseInt(hItem, 10) : 0);
    }
  };
  handleHash();
  window.addEventListener('hashchange', handleHash);

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
    const CACHE_KEY = 'bs_profile_2rguqjq0r_v4';
    const CACHE_TTL = 30 * 60 * 1000; // 30 минут

    const elTrophies = $('#bs-trophies');
    const elHighest = $('#bs-highest');
    const el3v3 = $('#bs-3v3');
    const elShowdown = $('#bs-showdown');
    const elBrawlers = $('#bs-brawlers');
    const elClub = $('#bs-club');
    const elSyncStatus = $('#bs-sync-status');
    const elSubPreview = $('#bs-sub-preview');
    const refreshBtn = $('#bsRefreshBtn');

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
        elSubPreview.textContent = `🏆 ${Number(data.trophies).toLocaleString('ru-RU')} кубков · 108 бойцов · Ежедневный актив · #2RGUQJQ0R`;
      }
      if (elSyncStatus) {
        elSyncStatus.textContent = isLive ? '🟢 Live: ~40k' : '🟢 Синхронизировано';
      }
    };

    // Очистка старых версий кэша с заниженными кубками (38k)
    try {
      ['bs_profile_2rguqjq0r', 'bs_profile_2rguqjq0r_v2', 'bs_profile_2rguqjq0r_v3'].forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }

    // Интерактивное мгновенное обновление кубков в реальном времени
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const curVal = elTrophies ? elTrophies.textContent.replace(/[^\d]/g, '') : '39950';
        const input = window.prompt('Укажите текущее количество кубков в Brawl Stars (например: 40050):', curVal);
        if (!input) return;

        const num = parseInt(input.replace(/[^\d]/g, ''), 10);
        if (!isNaN(num) && num > 1000) {
          const updated = {
            trophies: num,
            highest: Math.max(num, 40120),
            brawlers: '108 / 108',
            victories3v3: 2840,
            showdown: 1530,
            club: '0.3.7|teams'
          };
          updateDOM(updated, true);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: updated, timestamp: Date.now() }));
          } catch {}
          playSfx('ok');
          showPs3Toast('Brawl Stars', `Кубки обновлены: ${num.toLocaleString('ru-RU')}`);
        }
      });
    }

    // 1. Проверяем свежий кэш в localStorage
    let hasFreshCache = false;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.data?.trophies && parsed.data.trophies >= 39000) {
          updateDOM(parsed.data, false);
          if (Date.now() - parsed.timestamp < CACHE_TTL) {
            hasFreshCache = true;
          }
        }
      }
    } catch { /* ignore cache read error */ }

    // 2. Чтение локального JSON файла (assets/data/brawl.json или data/brawl.json)
    const loadLocalJson = async () => {
      const jsonPaths = ['data/brawl.json', 'assets/data/brawl.json'];
      for (const p of jsonPaths) {
        try {
          const resp = await fetch(`${p}?_=${Date.now()}`);
          if (resp.ok) {
            const raw = await resp.json();
            if (raw && raw.trophies && raw.trophies >= 38000) {
              const normalized = {
                trophies: raw.trophies,
                highest: raw.highestTrophies || raw.highest || raw.trophies,
                victories3v3: raw.victories3v3 || 2840,
                showdown: raw.showdown || 1530,
                brawlers: raw.brawlers || `${raw.brawlersUnlocked || 108} / ${raw.brawlersTotal || 108}`,
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

    // Загружаем локальные данные
    loadLocalJson();
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
        topPillText.textContent = isPlaying ? `В игре: ${title}` : `PS5: ${title}`;
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
          progPill.innerHTML = `<img class="ps-trophy-img" src="assets/icons/trophies/gold.svg" alt="" width="15" height="15"> <b>${pct}%</b> трофеев (${earned}/${total})`;
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
      const extraRank = rank ? ` · Rank ${rank}` : '';
      elProgresses.forEach(el => {
        el.innerHTML = `<img class="ps-trophy-img" src="assets/icons/trophies/gold.svg" alt="" width="14" height="14"> <span><b>${pct}%</b> (${earned}/${total} трофеев)${extraRank}</span>`;
      });

      // 5. Обновление счетчиков трофеев в карточке профиля cr1mnsx
      if (game.platinum !== undefined || game.trophy_breakdown) {
        const pl = game.platinum !== undefined ? game.platinum : (game.trophy_breakdown?.platinum || 0);
        const g = game.gold !== undefined ? game.gold : (game.trophy_breakdown?.gold || 0);
        const s = game.silver !== undefined ? game.silver : (game.trophy_breakdown?.silver || 0);
        const b = game.bronze !== undefined ? game.bronze : (game.trophy_breakdown?.bronze || 0);
        $$('.ps5-stat-plat').forEach(el => { el.innerHTML = `<b>${pl}</b>`; });
        $$('.ps5-stat-gold').forEach(el => { el.innerHTML = `<b>${g}</b>`; });
        $$('.ps5-stat-silver').forEach(el => { el.innerHTML = `<b>${s}</b>`; });
        $$('.ps5-stat-bronze').forEach(el => { el.innerHTML = `<b>${b}</b>`; });
        $$('.ps5-stat-trophy-pct').forEach(el => { el.innerHTML = `<b>${pct}%</b>`; });
      }
    };

    // Клик по плашке в шапке переносит в категорию PlayStation 5 к последней игре
    const topPill = $('#ps5TopPill');
    if (topPill) {
      topPill.addEventListener('click', () => {
        if (window.xmbGoto) window.xmbGoto('souls', 1);
      });
    }

    // Автоматическое создание красивого эмбиент-фона для всех баннеров игр
    const initAmbientGameBanners = () => {
      $$('.game-banner-link').forEach(link => {
        const img = $('img.game-banner-img', link);
        if (img && !$('.game-banner-bg', link) && !img.src.includes('brawl-stars-banner') && !img.src.includes('terminal')) {
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
                bronze: rawGame.bronze !== undefined ? rawGame.bronze : rawGame.trophy_breakdown?.bronze,
                silver: rawGame.silver !== undefined ? rawGame.silver : rawGame.trophy_breakdown?.silver,
                gold: rawGame.gold !== undefined ? rawGame.gold : rawGame.trophy_breakdown?.gold,
                platinum: rawGame.platinum !== undefined ? rawGame.platinum : rawGame.trophy_breakdown?.platinum,
                last_played_text: rawGame.last_played_text || rawGame.last_played || '8 октября 2026',
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

    // Запускаем немедленно и ставим периодический опрос раз в 60 секунд
    loadLocalPSN();
    setInterval(loadLocalPSN, 60000);
  };

  /* ==================================================
     1. 3D-НАКЛОН КАРТОЧЕК ПРИ НАВЕДЕНИИ (AERO GLASS TILT)
     ================================================== */
  function initAeroTilt() {
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!canHover) return;

    const selector = [
      '.aero-tilt',
      '.pgc-card',
      '.game-banner-widget',
      '.kpi-card',
      '.bs-profile-card',
      '.twitch-quicklink',
      '.twitch-xmb-card',
      '.twitch-xmb-player-box',
      '.twitch-chip',
      '.psn-terminal-widget',
      '.psn-meta',
      '.ps5-last-played-widget',
      '.ds2-player-box',
      '.p-card',
      '.item__panel--stats'
    ].join(', ');
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
        // Предотвращаем конфликт при вложенных 3D-карточках
        e.stopPropagation();

        const rect = card.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Нормализованные координаты: от -1 до +1
        const nx = (x / rect.width) * 2 - 1;
        const ny = (y / rect.height) * 2 - 1;

        // Для крупных информационных панелей угол умереннее (5.5°), для средних и компактных — 8°
        const maxTilt = (rect.height > 220 || rect.width > 420) ? 5.5 : 8;
        targetRotX = (-ny * maxTilt).toFixed(2);
        targetRotY = (nx * maxTilt).toFixed(2);

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
     2. ПРАВАЯ ПАНЕЛЬ СТРИМА И КЛИПОВ МАФАНИ (XMB WIDGET)
     ================================================== */
  const MAFANYA_CLIPS = [
    {
      id: "298570751",
      slug: "HotVivaciousFriesVoteYea-9fkRtKnjkuqCoaQg",
      title: "на очки смотрите",
      views: "64k просмотров",
      duration: "0:08",
      thumb: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/b4bb6b4a-2c12-49e4-a9ff-6418a2f89981/landscape/thumb/thumb-0000000000-1920x1080.jpg"
    },
    {
      id: "1876292169",
      slug: "EnthusiasticFastSandpiperCoolCat-fhmWZJABduephwMf",
      title: "зажигалку",
      views: "57k просмотров",
      duration: "0:04",
      thumb: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/c47f1092-4d00-4cbd-8c42-fe3b63257056/landscape/thumb/thumb-0000000000-1280x720.jpg"
    },
    {
      id: "1799801386",
      slug: "TemperedSpoopyAlpacaDansGame-UKZVZihVQIKHU2hD",
      title: "????????",
      views: "37k просмотров",
      duration: "0:25",
      thumb: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/a351f8ad-2197-468a-b064-a3380d1c97dc/landscape/thumb/thumb-0000000000-1280x720.jpg"
    },
    {
      id: "1791436173",
      slug: "ArbitraryArborealBeeTF2John-xuGhXsTHBi53TZgW",
      title: "Вакхо",
      views: "28k просмотров",
      duration: "0:15",
      thumb: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/695abb9f-07e3-4c47-a58a-eabd7726bf03/landscape/thumb/thumb-0000000000-1920x1080.jpg"
    },
    {
      id: "3383108569",
      slug: "GrossAmericanFlyRalpherZ-tWCiQng70gWa3dfY",
      title: "YandexGO",
      views: "26k просмотров",
      duration: "0:25",
      thumb: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/b530daf4-7215-47c2-9a03-c5176e773213/landscape/thumb/thumb-0000000000-1280x720.jpg"
    }
  ];

  currentClipsList = [...MAFANYA_CLIPS];
  currentClipIndex = 0;
  activeTwitchTab = 'clips';
  twitchIsLiveNow = false;

  function getTwitchParentQuery() {
    const currentHost = window.location.hostname || 'crimnsx-alt.github.io';
    const hosts = ['crimnsx-alt.github.io', 'localhost', '127.0.0.1'];
    if (currentHost && !hosts.includes(currentHost)) hosts.push(currentHost);
    return hosts.map(h => `parent=${encodeURIComponent(h)}`).join('&');
  }

  function loadTwitchXmbIframe(autoplay = true) {
    const iframe = $('#twitchXmbIframe');
    if (!iframe) return;
    const parentQuery = getTwitchParentQuery();
    const targetSrc = `https://player.twitch.tv/?channel=mafanyaking&${parentQuery}&muted=false&autoplay=${autoplay ? 'true' : 'false'}`;
    if (iframe.src !== targetSrc) {
      iframe.src = targetSrc;
    }
  }

  function unloadTwitchXmbIframe() {
    const liveIframe = $('#twitchXmbIframe');
    if (liveIframe && liveIframe.src) liveIframe.src = '';
    const clipIframe = $('#twitchClipIframe');
    if (clipIframe && clipIframe.src) clipIframe.src = '';
  }

  function loadTwitchClip(index = 0, autoplay = false) {
    if (!currentClipsList.length) return;
    const safeIndex = clamp(index, 0, currentClipsList.length - 1);
    currentClipIndex = safeIndex;
    const clip = currentClipsList[safeIndex];

    const clipIframe = $('#twitchClipIframe');
    if (clipIframe && clip) {
      const parentQuery = getTwitchParentQuery();
      const targetSrc = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip.slug)}&${parentQuery}&autoplay=${autoplay ? 'true' : 'false'}`;
      if (clipIframe.src !== targetSrc) {
        clipIframe.src = targetSrc;
      }
    }

    const nowPlayingEl = $('#twitchClipsNowPlaying');
    if (nowPlayingEl && clip) {
      nowPlayingEl.textContent = `▶ «${clip.title}»`;
    }

    const ctaLink = $('#twitchXmbCta');
    const ctaText = $('#twitchCtaText');
    if (ctaLink && clip) {
      ctaLink.href = `https://clips.twitch.tv/${clip.slug}`;
      if (ctaText) ctaText.textContent = `Смотреть клип «${clip.title}» на Twitch ↗`;
    }

    // Подсветка активной карточки
    const cards = $$('.twitch-clip-card');
    cards.forEach((card, i) => {
      card.classList.toggle('is-active', i === safeIndex);
    });
  }

  function renderTwitchClips() {
    const carousel = $('#twitchClipsCarousel');
    if (!carousel) return;
    carousel.innerHTML = currentClipsList.map((clip, idx) => `
      <button type="button" class="twitch-clip-card ${idx === currentClipIndex ? 'is-active' : ''}" data-index="${idx}" aria-label="Смотреть клип: ${clip.title}">
        <div class="twitch-clip-thumb-wrap">
          <img class="twitch-clip-thumb" src="${clip.thumb}" alt="${clip.title}" loading="lazy">
          <span class="twitch-clip-dur">${clip.duration}</span>
          <div class="twitch-clip-play-icon">▶</div>
        </div>
        <div class="twitch-clip-meta">
          <strong class="twitch-clip-title" title="${clip.title}">${clip.title}</strong>
          <span class="twitch-clip-views">${clip.views}</span>
        </div>
      </button>
    `).join('');

    $$('.twitch-clip-card', carousel).forEach((card) => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(card.dataset.index, 10);
        if (!isNaN(idx)) {
          playSfx('ok');
          loadTwitchClip(idx, true);
        }
      });
    });
  }

  function switchTwitchTab(tabName) {
    activeTwitchTab = tabName;
    const tabClipsBtn = $('#twitchTabClips');
    const tabLiveBtn = $('#twitchTabLive');
    const clipIframe = $('#twitchClipIframe');
    const liveIframe = $('#twitchXmbIframe');
    const clipsSection = $('#twitchClipsSection');
    const ctaLink = $('#twitchXmbCta');
    const ctaText = $('#twitchCtaText');

    if (tabName === 'clips') {
      if (tabClipsBtn) {
        tabClipsBtn.classList.add('is-active');
        tabClipsBtn.setAttribute('aria-selected', 'true');
      }
      if (tabLiveBtn) {
        tabLiveBtn.classList.remove('is-active');
        tabLiveBtn.setAttribute('aria-selected', 'false');
      }
      if (clipIframe) clipIframe.style.display = 'block';
      if (liveIframe) liveIframe.style.display = 'none';
      if (clipsSection) clipsSection.style.display = 'flex';

      loadTwitchClip(currentClipIndex, false);
    } else if (tabName === 'live') {
      if (tabLiveBtn) {
        tabLiveBtn.classList.add('is-active');
        tabLiveBtn.setAttribute('aria-selected', 'true');
      }
      if (tabClipsBtn) {
        tabClipsBtn.classList.remove('is-active');
        tabClipsBtn.setAttribute('aria-selected', 'false');
      }
      if (liveIframe) liveIframe.style.display = 'block';
      if (clipIframe) clipIframe.style.display = 'none';
      if (clipsSection) clipsSection.style.display = 'none';

      loadTwitchXmbIframe(true);
      if (ctaLink) ctaLink.href = 'https://www.twitch.tv/mafanyaking';
      if (ctaText) ctaText.textContent = 'Открыть канал Влада на Twitch ↗';
    }
  }

  function onMafanyaSelected() {
    if (activeTwitchTab === 'live' || twitchIsLiveNow) {
      loadTwitchXmbIframe(true);
    } else {
      loadTwitchClip(currentClipIndex, false);
    }
  }

  function onMafanyaDeselected() {
    unloadTwitchXmbIframe();
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
    const lastDateEl = $('#twitchXmbLastDate');
    const tabLiveLabel = $('#twitchTabLiveLabel');

    twitchIsLiveNow = Boolean(info.isLive);

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
      if (tabLiveLabel) tabLiveLabel.textContent = `🔴 Прямой эфир (${Number(info.viewers || 0).toLocaleString('ru-RU')})`;

      if (titleEl && info.title) titleEl.textContent = info.title;
      if (catEl && info.game) catEl.textContent = `🎮 ${info.game}`;
      if (viewersEl && info.viewers) viewersEl.textContent = `👥 ${Number(info.viewers).toLocaleString('ru-RU')} зрителей`;
      if (uptimeEl && info.uptime) {
        uptimeEl.style.display = 'inline-flex';
        uptimeEl.textContent = `⏱ ${info.uptime}`;
      }
      if (lastDateEl) lastDateEl.style.display = 'none';

      // Если стример запустил эфир — автоматически переключаем на вкладку прямого эфира
      switchTwitchTab('live');
    } else {
      if (statusPill) {
        statusPill.classList.remove('is-live');
        statusPill.classList.add('is-offline');
      }
      if (statusLabel) statusLabel.textContent = '⚪ ОФФЛАЙН';
      if (topPillDot) topPillDot.classList.remove('is-live');
      if (topPillText) topPillText.textContent = 'Мафаня';
      if (menuBadge) menuBadge.style.display = 'none';
      if (tabLiveLabel) tabLiveLabel.textContent = 'Канал Twitch';

      if (titleEl) {
        titleEl.textContent = info.lastBroadcastTitle 
          ? `Последний стрим: «${info.lastBroadcastTitle}»` 
          : 'Канал Влада Мафани на Twitch';
      }
      if (catEl) catEl.textContent = '🎮 Общение & Пранки';
      if (viewersEl) viewersEl.textContent = '👥 561k фолловеров';
      if (uptimeEl) uptimeEl.style.display = 'none';
      if (lastDateEl && info.startedAt) {
        lastDateEl.style.display = 'inline-flex';
        const d = new Date(info.startedAt);
        if (!isNaN(d.getTime())) {
          lastDateEl.textContent = `⏱ ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
        }
      }

      // При оффлайне остаёмся на вкладке клипов
      if (activeTwitchTab !== 'live') {
        switchTwitchTab('clips');
      }
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
            startedAt: user.lastBroadcast?.startedAt,
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

  async function fetchDynamicClips() {
    try {
      const res = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: { 'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko' },
        body: JSON.stringify({
          query: 'query { user(login: "mafanyaking") { clips(first: 6) { edges { node { id slug title viewCount durationSeconds thumbnailURL } } } } }'
        })
      });
      if (res.ok) {
        const json = await res.json();
        const edges = json?.data?.user?.clips?.edges;
        if (Array.isArray(edges) && edges.length > 0) {
          const dynamicClips = edges.map(e => {
            const n = e.node;
            const viewsK = n.viewCount >= 1000 ? `${Math.round(n.viewCount / 1000)}k` : n.viewCount;
            const min = Math.floor(n.durationSeconds / 60);
            const sec = String(Math.floor(n.durationSeconds % 60)).padStart(2, '0');
            return {
              id: n.id,
              slug: n.slug,
              title: n.title,
              views: `${viewsK} просмотров`,
              duration: `${min}:${sec}`,
              thumb: n.thumbnailURL
            };
          });
          currentClipsList = dynamicClips;
          renderTwitchClips();
          if (activeTwitchTab === 'clips') {
            loadTwitchClip(currentClipIndex, false);
          }
        }
      }
    } catch {}
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

    // Вкладки клипы / стрим
    const tabClips = $('#twitchTabClips');
    const tabLive = $('#twitchTabLive');
    if (tabClips) {
      tabClips.addEventListener('click', (e) => {
        e.preventDefault();
        playSfx('ok');
        switchTwitchTab('clips');
      });
    }
    if (tabLive) {
      tabLive.addEventListener('click', (e) => {
        e.preventDefault();
        playSfx('ok');
        switchTwitchTab('live');
      });
    }

    // Первичный рендер клипов и проверка статуса
    renderTwitchClips();
    switchTwitchTab('clips');
    checkTwitchLiveStatus();
    fetchDynamicClips();
    setInterval(checkTwitchLiveStatus, 60000);
  }

  /* ---------- Аутентичные часы PS3 (Скриншот 3: M/D HH:MM 🕒) ---------- */
  function initPs3ClockWidget() {
    function updateClock() {
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');

      const dateEl = $('#ps3ClockDate');
      const timeEl = $('#ps3ClockTime');
      if (dateEl) dateEl.textContent = `${month}/${day}`;
      if (timeEl) timeEl.textContent = `${hours}:${minutes}`;
    }
    updateClock();
    setInterval(updateClock, 1000);
  }

  /* ---------- Гарантированное увеличение иконки автора при наведении ---------- */
  function initAvatarHoverZoom() {
    const avatarLinks = $$('.item__icon--photo, .item__icon--photo .avatar');
    avatarLinks.forEach((el) => {
      el.addEventListener('mouseenter', () => {
        el.style.setProperty('transform', 'scale(1.3)', 'important');
        el.style.setProperty('filter', 'drop-shadow(0 0 24px rgba(0, 190, 255, 0.95))', 'important');
        el.style.setProperty('z-index', '9999', 'important');
      });
      el.addEventListener('mouseleave', () => {
        el.style.removeProperty('transform');
        el.style.removeProperty('filter');
        el.style.removeProperty('z-index');
      });
    });
  }

  /* ---------- Яндекс Музыка: Управление плейлистом и виджетом ---------- */
  function initYandexMusicWidget() {
    const DEFAULT_EMBED = 'https://music.yandex.ru/iframe/playlist/446019089/3';
    const DEFAULT_URL = 'https://music.yandex.ru/playlists/lk.67e283d6-a061-4e6d-b74f-27e04c3f412f';
    const STORAGE_KEY_EMBED = 'ym_embed_src_cr1mnsx_v4';
    const STORAGE_KEY_URL = 'ym_web_url_cr1mnsx_v4';

    const iframe = $('#ymIframePlayer');
    const profilePlayBtn = $('#ymProfilePlayBtn');
    const changeBtn = $('#ymChangePlaylistBtn');
    const profileExtLink = $('#ymProfileExtLink');
    const directLink = $('#ymDirectLink');

    const parseYandexMusicUrl = (input) => {
      if (!input) return null;
      const trimmed = input.trim();

      // Прямой iframe URL
      if (trimmed.includes('music.yandex.ru/iframe/')) {
        return {
          embed: trimmed,
          web: trimmed.replace('/iframe/', '/').replace('#', '')
        };
      }

      // Плейлист вида playlists/lk.UUID
      const lkMatch = trimmed.match(/playlists\/(lk\.[a-zA-Z0-9_-]+)/i);
      if (lkMatch) {
        const embedUrl = (lkMatch[1] === 'lk.67e283d6-a061-4e6d-b74f-27e04c3f412f')
          ? 'https://music.yandex.ru/iframe/playlist/446019089/3'
          : `https://music.yandex.ru/iframe/playlist/${lkMatch[1]}`;
        return {
          embed: embedUrl,
          web: `https://music.yandex.ru/playlists/${lkMatch[1]}`
        };
      }

      // Плейлист: music.yandex.ru/users/USER/playlists/KIND
      const plMatch = trimmed.match(/(?:users\/([^\/\s]+)\/playlists\/(\d+))/i);
      if (plMatch) {
        const user = plMatch[1];
        const kind = plMatch[2];
        return {
          embed: `https://music.yandex.ru/iframe/playlist/${user}/${kind}`,
          web: `https://music.yandex.ru/users/${user}/playlists/${kind}`
        };
      }

      // Короткий формат: USER/KIND
      const shortPlMatch = trimmed.match(/^([a-zA-Z0-9._-]+)\/(\d+)$/);
      if (shortPlMatch) {
        return {
          embed: `https://music.yandex.ru/iframe/playlist/${shortPlMatch[1]}/${shortPlMatch[2]}`,
          web: `https://music.yandex.ru/users/${shortPlMatch[1]}/playlists/${shortPlMatch[2]}`
        };
      }

      // Альбом: music.yandex.ru/album/12345
      const albMatch = trimmed.match(/album\/(\d+)/i);
      if (albMatch) {
        return {
          embed: `https://music.yandex.ru/iframe/#album/${albMatch[1]}`,
          web: `https://music.yandex.ru/album/${albMatch[1]}`
        };
      }

      // Трек: music.yandex.ru/album/123/track/456 или music.yandex.ru/track/456
      const trkMatch = trimmed.match(/track\/(\d+)/i);
      if (trkMatch) {
        return {
          embed: `https://music.yandex.ru/iframe/#track/${trkMatch[1]}`,
          web: `https://music.yandex.ru/track/${trkMatch[1]}`
        };
      }

      if (trimmed.startsWith('http')) {
        return {
          embed: DEFAULT_EMBED,
          web: trimmed
        };
      }

      return null;
    };

    const applyUrls = (embedUrl, webUrl) => {
      if (iframe && embedUrl) iframe.src = embedUrl;
      if (profileExtLink && webUrl) profileExtLink.href = webUrl;
      if (directLink && webUrl) directLink.href = webUrl;
    };

    // 1. Восстановление сохранённого плейлиста из localStorage
    try {
      const savedEmbed = localStorage.getItem(STORAGE_KEY_EMBED) || DEFAULT_EMBED;
      const savedWeb = localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL;
      applyUrls(savedEmbed, savedWeb);
    } catch {}

    // 2. Клик на кнопку «Слушать в ветке Музыки ♫» в профиле cr1mnsx
    if (profilePlayBtn) {
      profilePlayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        playSfx('ok');
        window.xmbGoto('music', 0);
        showPs3Toast('Яндекс Музыка', 'Открыт плеер плейлиста');
      });
    }

    // 3. Кнопка «Сменить плейлист»
    if (changeBtn) {
      changeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentUrl = localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL;
        const input = window.prompt(
          'Вставьте ссылку на ваш плейлист или трек в Яндекс Музыке\n(например: https://music.yandex.ru/playlists/lk.67e283d6-a061-4e6d-b74f-27e04c3f412f):',
          currentUrl
        );
        if (!input) return;

        const parsed = parseYandexMusicUrl(input);
        if (parsed) {
          applyUrls(parsed.embed, parsed.web);
          try {
            localStorage.setItem(STORAGE_KEY_EMBED, parsed.embed);
            localStorage.setItem(STORAGE_KEY_URL, parsed.web);
          } catch {}
          playSfx('ok');
          showPs3Toast('Плейлист обновлён', 'Яндекс Музыка успешно подключена');
        } else {
          alert('Не удалось распознать ссылку на Яндекс Музыку. Проверьте формат.');
        }
      });
    }
  }

  initBrawlStarsSync();
  initPS5LastPlayedSync();
  initAeroTilt();
  initTwitchXmbWidget();
  initPs3ClockWidget();
  initAvatarHoverZoom();
  initYandexMusicWidget();

  /* ==========================================================================
     ИНТЕРАКТИВНЫЕ ВИДЖЕТЫ BIO: ТРОФЕИ САЙТА, ЦИТАТНИК, ПОДЕЛИТЬСЯ
     ========================================================================== */

  // 1. Система трофеев сайта (PlayStation 3 Trophies)
  function initSiteTrophies() {
    const STORAGE_KEY = 'cr1mnsx_site_trophies_v1';
    const TROPHIES = {
      welcome: {
        id: 'welcome',
        name: 'Добро пожаловать в Дранглик',
        desc: 'Посетить био-сайт cr1mnsx и войти в XMB интерфейс',
        grade: 'Бронзовый приз',
        icon: '<img src="assets/icons/trophies/bronze.svg" width="22" height="22" alt="Bronze">'
      },
      bio: {
        id: 'bio',
        name: 'Хранитель Огня',
        desc: 'Открыть и прочитать раздел «Биография cr1mnsx»',
        grade: 'Серебряный приз',
        icon: '<img src="assets/icons/trophies/silver.svg" width="22" height="22" alt="Silver">'
      },
      gaming: {
        id: 'gaming',
        name: 'Платиновый Охотник',
        desc: 'Изучить витрину платиновых наград в разделе Gaming Showcase',
        grade: 'Золотой приз',
        icon: '<img src="assets/icons/trophies/gold.svg" width="22" height="22" alt="Gold">'
      },
      explorer: {
        id: 'explorer',
        name: 'Истинный путник',
        desc: 'Осмотреть все категории XMB меню сайта',
        grade: 'Платиновый приз',
        icon: '<img src="assets/icons/trophies/plat.svg" width="24" height="24" alt="Platinum">'
      }
    };

    let unlocked = new Set();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) saved.forEach(k => unlocked.add(k));
    } catch {}

    const visitedCats = new Set([0]);

    function save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(unlocked)));
      } catch {}
    }

    function renderTrophiesUI() {
      const countBadge = document.getElementById('siteTrophyCountBadge');
      const progressFill = document.getElementById('siteTrophyProgressFill');
      const total = Object.keys(TROPHIES).length;
      const count = unlocked.size;

      if (countBadge) countBadge.textContent = `${count} / ${total}`;
      if (progressFill) progressFill.style.width = `${(count / total) * 100}%`;

      // Update cards
      Object.keys(TROPHIES).forEach(key => {
        const cardId = key === 'welcome' ? 'trCardWelcome' :
                       key === 'bio' ? 'trCardBio' :
                       key === 'gaming' ? 'trCardGaming' : 'trCardPlatinum';
        const statusId = key === 'welcome' ? 'trStatusWelcome' :
                         key === 'bio' ? 'trStatusBio' :
                         key === 'gaming' ? 'trStatusGaming' : 'trStatusPlatinum';
        const card = document.getElementById(cardId);
        const status = document.getElementById(statusId);
        if (card && status) {
          const isUnlocked = unlocked.has(key);
          card.classList.toggle('is-unlocked', isUnlocked);
          status.textContent = isUnlocked ? 'Получен 🏆' : 'Заблокирован 🔒';
        }
      });
    }

    function unlockTrophy(key) {
      if (unlocked.has(key) || !TROPHIES[key]) return;
      unlocked.add(key);
      save();
      renderTrophiesUI();

      // Play PS3 Trophy Chime
      playSfx('trophy');

      // Show PS3 Toast
      const tr = TROPHIES[key];
      showPs3Toast(`Вы получили приз! (${tr.grade})`, tr.name, tr.icon);
    }

    window.unlockSiteTrophy = unlockTrophy;

    window.trackCatVisit = (catIdx) => {
      visitedCats.add(catIdx);
      if (visitedCats.size >= cats.length) {
        unlockTrophy('explorer');
      }
      if (cats[catIdx] && cats[catIdx].id === 'souls') {
        unlockTrophy('gaming');
      }
    };

    window.checkNavTrophy = (catIdx, itemIdx) => {
      const curCat = cats[catIdx];
      if (!curCat) return;
      const curItems = itemsOf(catIdx);
      const curItem = curItems[itemIdx];
      if (!curItem) return;

      if (curItem.id === 'itemBioStory') {
        unlockTrophy('bio');
      } else if (curItem.id === 'itemGamingShowcase') {
        unlockTrophy('gaming');
      }
    };

    // Reset button
    const resetBtn = document.getElementById('btnResetSiteTrophies');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        unlocked.clear();
        save();
        renderTrophiesUI();
        playSfx('ok');
        showPs3Toast('Сброс трофеев', 'Прогресс достижений сайта сброшен для теста');
      });
    }

    // Auto unlock Welcome trophy on load after short delay
    setTimeout(() => {
      unlockTrophy('welcome');
    }, 1800);

    renderTrophiesUI();
  }

  // 2. Интерактивный генератор цитат Dark Souls
  function initBioQuoteWidget() {
    const quotes = [
      { text: "«Don't you dare go Hollow. Lest my work have been for naught.»", author: "— Laurentius of the Great Swamp" },
      { text: "«Praise the Sun! The sun is a wondrous body. Like a magnificent father!»", author: "— Solaire of Astora" },
      { text: "«There is no path. Beyond the scope of light, beyond the reach of Dark... what could possibly await us?»", author: "— Aldia, Scholar of the First Sin" },
      { text: "«My name is Lucatiel. I beg of you, remember my name. For I may not myself, but a little while...»", author: "— Lucatiel of Mirrah" },
      { text: "«Don't get yourself killed. Neither of us wants to see you go Hollow.»", author: "— Andre of Astora" },
      { text: "«Ashen one, hearest thou my voice still?»", author: "— Fire Keeper" },
      { text: "«A hunter must hunt. Even in a dream.»", author: "— Eileen the Crow" },
      { text: "«Hesitation is defeat.»", author: "— Isshin, the Sword Saint" }
    ];

    const quoteText = document.getElementById('bioQuoteText');
    const quoteAuthor = document.getElementById('bioQuoteAuthor');
    const newQuoteBtn = document.getElementById('bioNewQuoteBtn');
    let currentIndex = 0;

    if (newQuoteBtn && quoteText && quoteAuthor) {
      newQuoteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        playSfx('ok');

        let nextIdx;
        do {
          nextIdx = Math.floor(Math.random() * quotes.length);
        } while (nextIdx === currentIndex && quotes.length > 1);
        currentIndex = nextIdx;

        quoteText.style.opacity = '0';
        quoteAuthor.style.opacity = '0';
        setTimeout(() => {
          quoteText.textContent = quotes[currentIndex].text;
          quoteAuthor.textContent = quotes[currentIndex].author;
          quoteText.style.opacity = '1';
          quoteAuthor.style.opacity = '1';
        }, 150);
      });
    }
  }

  // 3. Копирование ссылки на профиль (Share & QR)
  function initShareBioWidget() {
    const copyBtn = document.getElementById('btnCopyShareUrl');
    const copyText = document.getElementById('btnCopyShareText');
    const url = 'https://crimnsx-alt.github.io/cr1mnsx';

    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          } else {
            const ta = document.createElement('textarea');
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          playSfx('ok');
          if (copyText) copyText.textContent = 'Скопировано! ✓';
          showPs3Toast('Ссылка скопирована', 'Поделитесь био-профилем cr1mnsx');
          setTimeout(() => {
            if (copyText) copyText.textContent = 'Скопировать ссылку 📋';
          }, 3000);
        } catch {
          prompt('Скопируйте ссылку вручную:', url);
        }
      });
    }
  }

  initSiteTrophies();
  initBioQuoteWidget();
  initShareBioWidget();
})();
