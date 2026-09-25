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
        if (on && !far) loadThumb(item);
      });
    });

    // листаем пункты — на телефоне прячем термометр, чтобы не мешался
    root.classList.toggle('items-scrolled', selected[current] > 0);
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
    bgmAudio.volume = 0.5;
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

  /* ---------- Звуковой эффект костра Dark Souls (Синтез шума огня и колокола) ---------- */
  function playBonfireSound() {
    initAudio();
    if (!audioCtx) return;
    try {
      const t = audioCtx.currentTime;
      // 1. Теплый глубокий бас резонанса костра
      const oscBass = audioCtx.createOscillator();
      const bassGain = audioCtx.createGain();
      oscBass.type = 'sine';
      oscBass.frequency.setValueAtTime(120, t);
      oscBass.frequency.exponentialRampToValueAtTime(55, t + 1.2);
      bassGain.gain.setValueAtTime(0.18, t);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      oscBass.connect(bassGain);
      bassGain.connect(audioCtx.destination);
      oscBass.start(t);
      oscBass.stop(t + 1.45);

      // 2. Треск и шум пламени (Pink noise / filter buffer)
      const bufferSize = audioCtx.sampleRate * 1.5;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02; // имитация розового шума
        lastOut = data[i];
        data[i] *= 3.5;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(450, t);
      noiseFilter.frequency.linearRampToValueAtTime(1400, t + 0.3);
      noiseFilter.frequency.exponentialRampToValueAtTime(300, t + 1.5);
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.001, t);
      noiseGain.gain.linearRampToValueAtTime(0.22, t + 0.25);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noise.start(t);
      noise.stop(t + 1.55);

      // 3. Мистический колокольный перелив
      const chime = audioCtx.createOscillator();
      const chimeGain = audioCtx.createGain();
      chime.type = 'triangle';
      chime.frequency.setValueAtTime(440, t + 0.1);
      chime.frequency.exponentialRampToValueAtTime(880, t + 0.6);
      chimeGain.gain.setValueAtTime(0.001, t + 0.1);
      chimeGain.gain.linearRampToValueAtTime(0.08, t + 0.3);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      chime.connect(chimeGain);
      chimeGain.connect(audioCtx.destination);
      chime.start(t + 0.1);
      chime.stop(t + 1.85);
    } catch { /* ignore */ }
  }

  /* ---------- Баннер «Зажечь костёр» и оверлей BONFIRE LIT ---------- */
  const bonfireBanner = $('#bonfireBanner');
  const bonfireLitBtn = $('#bonfireLitBtn');
  const bonfireLitOverlay = $('#bonfireLitOverlay');

  function triggerBonfireLit() {
    if (bonfireBanner) bonfireBanner.classList.add('is-hidden');
    playBonfireSound();
    if (bonfireLitOverlay) {
      bonfireLitOverlay.classList.add('is-active');
      setTimeout(() => {
        bonfireLitOverlay.classList.remove('is-active');
      }, 3500);
    }
    // Плавное включение саундтрека Маджулы
    playBgm();
  }

  if (bonfireLitBtn) {
    bonfireLitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerBonfireLit();
    });
  }

  // Автоматический запуск фоновой темы:
  // 1. Сразу вешаем перехват любого первого действия (клик, тап, скролл, клавиша).
  // 2. Пытаемся воспроизвести немедленно при загрузке.
  const gestureEvents = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'wheel', 'scroll', 'click'];
  const onUserGestureForBgm = () => {
    if (localStorage.getItem('ps3_bgm_disabled') === '1') {
      removeAutoStartListeners();
      return;
    }
    if (bgmAudio && bgmAudio.paused) {
      bgmAudio.volume = 0.5;
      bgmAudio.play().then(() => {
        updateBgmUI(true);
        if (bonfireBanner) bonfireBanner.classList.add('is-hidden');
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
        playBgm().then((started) => {
          if (started && bonfireBanner) {
            bonfireBanner.classList.add('is-hidden');
          }
        });
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

  const activate = () => {
    const item = itemsOf(current)[selected[current]];
    if (!item) return;
    playSfx('ok');
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

  /* ---------- Brawl Stars: Синхронизация статистики с Brawlify (#2RGUQJQ0R) ---------- */
  const initBrawlStarsSync = () => {
    const TAG = '2RGUQJQ0R';
    const CACHE_KEY = 'bs_profile_2rguqjq0r';
    const CACHE_TTL = 20 * 60 * 1000; // 20 минут

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
      if (elHighest && data.highest) elHighest.textContent = Number(data.highest).toLocaleString('ru-RU');
      if (el3v3 && data.victories3v3) el3v3.textContent = Number(data.victories3v3).toLocaleString('ru-RU');
      if (elShowdown && data.showdown) elShowdown.textContent = typeof data.showdown === 'number' ? Number(data.showdown).toLocaleString('ru-RU') : data.showdown;
      if (elBrawlers && data.brawlers) elBrawlers.textContent = data.brawlers;
      if (elClub && data.club) elClub.textContent = data.club;
      if (elSubPreview && data.trophies) {
        elSubPreview.textContent = `🏆 ${Number(data.trophies).toLocaleString('ru-RU')} кубков · 3v3 победы · Ежедневный актив · brawlify.com`;
      }
      if (elSyncStatus) {
        elSyncStatus.textContent = isLive ? '🟢 Live с Brawlify' : '🟢 Кэш готов';
      }
    };

    // 1. Проверяем кэш в localStorage
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        updateDOM(parsed.data, false);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          return; // Кэш еще свежий
        }
      }
    } catch { /* ignore cache read error */ }

    // 2. Парсер HTML страницы Brawlify
    const parseBrawlifyHTML = (html) => {
      if (!html || html.includes('Just a moment...') || html.includes('challenges.cloudflare.com')) {
        return null;
      }
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Ищем элементы со статистикой
        const textContent = doc.body.textContent || '';
        if (!textContent.includes('2RGUQJQ0R')) return null;

        const res = {};
        
        // Регулярные выражения по структуре Brawlify
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

        return Object.keys(res).length >= 2 ? res : null;
      } catch {
        return null;
      }
    };

    // 3. Каскад запросов через CORS-прокси
    const targetUrl = `https://brawlify.com/player/${TAG}`;
    const proxyList = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
    ];

    const fetchViaProxies = async () => {
      for (const pUrl of proxyList) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const resp = await fetch(pUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (resp.ok) {
            const html = await resp.text();
            const data = parseBrawlifyHTML(html);
            if (data) {
              updateDOM(data, true);
              localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
              return;
            }
          }
        } catch {
          // тихо пропускаем таймауты и Cloudflare ошибки, не мусоря в консоль
        }
      }
    };

    fetchViaProxies();
  };

  /* ---------- PlayStation 5: Синхронизация последней запущенной игры ---------- */
  const initPS5LastPlayedSync = () => {
    const PSN_USER = 'Cr1mnsx';
    const CACHE_KEY = 'ps5_last_played_cr1mnsx';
    const CACHE_TTL = 20 * 60 * 1000; // 20 минут

    const elTitles = $$('.ps5-last-game-title');
    const elImgs = $$('.ps5-last-game-img');
    const elPlatforms = $$('.ps5-last-game-platform');
    const elStatuses = $$('.ps5-last-game-status');
    const elProgresses = $$('.ps5-last-game-progress');
    const elBars = $$('.ps5-last-game-bar');

    const updateDOM = (game) => {
      if (!game) return;
      if (game.title) {
        elTitles.forEach(el => { el.textContent = game.title; });
      }
      if (game.image) {
        elImgs.forEach(el => {
          el.src = game.image;
          el.alt = game.title || 'PS5 Last Played Game';
        });
      }
      if (game.platform) {
        elPlatforms.forEach(el => { el.textContent = game.platform; });
      }
      if (game.last_played_text) {
        elStatuses.forEach(el => {
          el.textContent = `Последний запуск на PlayStation 5 · ${game.last_played_text}`;
        });
      }
      if (game.progress_percent !== undefined) {
        const pct = Math.min(100, Math.max(0, Number(game.progress_percent)));
        elBars.forEach(el => { el.style.width = `${pct}%`; });
        const earned = game.trophies_earned;
        const total = game.trophies_total;
        const extraRank = game.rank ? ` · ${game.rank} Rank` : '';
        const progressStr = (earned !== undefined && total !== undefined && total > 0)
          ? `🏆 ${earned}/${total} трофеев (${pct}%)${extraRank}`
          : `🏆 Прогресс: ${pct}%${extraRank}`;
        elProgresses.forEach(el => { el.textContent = progressStr; });
      }
    };

    // 1. Проверяем кэш в localStorage
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (data && (Date.now() - timestamp < CACHE_TTL)) {
          updateDOM(data);
          return;
        }
      }
    } catch {}

    // 2. Проверяем локальный data/psn_recent.json (100% надежный источник без Cloudflare)
    fetch('data/psn_recent.json')
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (json && json.game) {
          updateDOM(json.game);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: json.game, timestamp: Date.now() }));
          } catch {}
        }
      })
      .catch(() => {});

    // 3. Парсер HTML страницы PSN.GG / PSNProfiles
    const parsePSNHTML = (html) => {
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const gameRow = doc.querySelector('.game-row, .library-item, #gamesTable tr, tr.game');
        if (!gameRow) return null;

        const titleEl = gameRow.querySelector('.title, .game-title, a[href*="/game/"]');
        const imgEl = gameRow.querySelector('img.game, img.cover, img');
        const platEl = gameRow.querySelector('.platform, .badge-platform, span[class*="platform"]');
        const progressEl = gameRow.querySelector('.progress-bar span, .percentage, .trophy-progress');
        const dateEl = gameRow.querySelector('.small-info, .last-played, .date');

        if (!titleEl && !imgEl) return null;

        const title = titleEl ? titleEl.textContent.trim() : '';
        const image = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : '';
        const platform = platEl ? platEl.textContent.trim() : 'PS5';
        const progressMatch = progressEl ? progressEl.textContent.match(/(\d+)%/) : null;
        const percent = progressMatch ? parseInt(progressMatch[1], 10) : undefined;
        const dateText = dateEl ? dateEl.textContent.trim() : '';

        return {
          title,
          image,
          platform,
          progress_percent: percent,
          last_played_text: dateText
        };
      } catch {
        return null;
      }
    };

    // 4. Запрос через каскад CORS-прокси
    const targetUrl = `https://psn.gg/profile/${PSN_USER}`;
    const proxyList = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
    ];

    const fetchViaProxies = async () => {
      for (const pUrl of proxyList) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const resp = await fetch(pUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (resp.ok) {
            const html = await resp.text();
            const gameData = parsePSNHTML(html);
            if (gameData && gameData.title) {
              updateDOM(gameData);
              try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ data: gameData, timestamp: Date.now() }));
              } catch {}
              return;
            }
          }
        } catch {
          // тихо пропускаем таймауты
        }
      }
    };

    fetchViaProxies();
  };

  startBgmIfAllowed();
  initBrawlStarsSync();
  initPS5LastPlayedSync();
})();
