/**
 * ps3wave.js — Authentic PlayStation 3 XrossMediaBar (XMB) Silk Wave Engine v5.0
 * ------------------------------------------------------------------------------
 * Поддерживает:
 * - 7 официальных цветовых тем волн Sony PS3 (Original Blue, Ruby Red, Emerald,
 *   Amethyst Purple, Amber Gold, Midnight Onyx, Pearl Light)
 * - Прозрачное смешивание с динамическим фоном игры PIC1.PNG (.has-pic1)
 * - Аппаратное ускорение 60–120 FPS на одном Canvas
 */
(() => {
  'use strict';

  const canvas = document.createElement('canvas');
  canvas.id = 'ps3WaveCanvas';
  canvas.className = 'ps3-wave-canvas';

  const bgContainer = document.querySelector('.bg');
  if (bgContainer) {
    const bgVideo = document.getElementById('bgVideo');
    if (bgVideo) {
      bgVideo.pause();
      bgVideo.removeAttribute('src');
      bgVideo.style.display = 'none';
    }
    bgContainer.appendChild(canvas);
  } else {
    document.body.prepend(canvas);
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  const dpr = 1.0;
  let W = 0, H = 0;

  /* -- ОФИЦИАЛЬНЫЕ ЦВЕТОВЫЕ СХЕМЫ PS3 SYSTEM SOFTWARE -- */
  const PS3_THEMES = [
    {
      id: 'blue',
      name: 'Синяя (PS3 Original)',
      sky: ['#051329', '#0b2958', '#061a3c', '#020713'],
      wave0: 'rgba(255, 255, 255, 0.44)',
      wave1: 'rgba(56, 165, 255, 0.24)',
      wave2: 'rgba(10, 50, 130, 0.01)',
      strokeMain: 'rgba(235, 248, 255, 0.62)',
      strokeGlow: 'rgba(96, 185, 255, 0.32)'
    },
    {
      id: 'ruby',
      name: 'Рубиновая (Ruby Red)',
      sky: ['#260610', '#4d0d20', '#2e0714', '#0e0206'],
      wave0: 'rgba(255, 235, 240, 0.44)',
      wave1: 'rgba(244, 63, 94, 0.25)',
      wave2: 'rgba(110, 12, 35, 0.01)',
      strokeMain: 'rgba(255, 228, 235, 0.62)',
      strokeGlow: 'rgba(251, 113, 133, 0.32)'
    },
    {
      id: 'amethyst',
      name: 'Аметист (Amethyst)',
      sky: ['#16072b', '#2e1059', '#1b0938', '#080212'],
      wave0: 'rgba(248, 238, 255, 0.44)',
      wave1: 'rgba(168, 85, 247, 0.25)',
      wave2: 'rgba(65, 18, 120, 0.01)',
      strokeMain: 'rgba(243, 232, 255, 0.62)',
      strokeGlow: 'rgba(192, 132, 252, 0.32)'
    },
    {
      id: 'emerald',
      name: 'Изумруд (Emerald)',
      sky: ['#04221c', '#094538', '#052922', '#020e0b'],
      wave0: 'rgba(235, 255, 248, 0.42)',
      wave1: 'rgba(16, 185, 129, 0.24)',
      wave2: 'rgba(6, 78, 59, 0.01)',
      strokeMain: 'rgba(209, 250, 229, 0.60)',
      strokeGlow: 'rgba(52, 211, 153, 0.30)'
    },
    {
      id: 'gold',
      name: 'Золото Дранглика (Gold)',
      sky: ['#241504', '#472a08', '#291704', '#0d0701'],
      wave0: 'rgba(255, 248, 225, 0.44)',
      wave1: 'rgba(245, 158, 11, 0.25)',
      wave2: 'rgba(120, 53, 15, 0.01)',
      strokeMain: 'rgba(254, 243, 199, 0.62)',
      strokeGlow: 'rgba(251, 191, 36, 0.32)'
    },
    {
      id: 'onyx',
      name: 'Чёрный Оникс (PS3 Slim)',
      sky: ['#090d16', '#131c2e', '#0b101b', '#030509'],
      wave0: 'rgba(255, 255, 255, 0.38)',
      wave1: 'rgba(148, 163, 184, 0.20)',
      wave2: 'rgba(15, 23, 42, 0.01)',
      strokeMain: 'rgba(241, 245, 249, 0.55)',
      strokeGlow: 'rgba(148, 163, 184, 0.28)'
    }
  ];

  let currentThemeIdx = 0;
  try {
    const savedId = localStorage.getItem('ps3_wave_color');
    if (savedId) {
      const idx = PS3_THEMES.findIndex(t => t.id === savedId);
      if (idx !== -1) currentThemeIdx = idx;
    }
  } catch {}

  const updateWaveLabel = () => {
    const theme = PS3_THEMES[currentThemeIdx];
    const lbl = document.getElementById('ps3ColorNameLabel');
    if (lbl && theme) lbl.textContent = `Волна: ${theme.name.split(' ')[0]}`;
  };

  window.setPs3WaveColor = (idOrIdx) => {
    if (typeof idOrIdx === 'number') {
      currentThemeIdx = ((idOrIdx % PS3_THEMES.length) + PS3_THEMES.length) % PS3_THEMES.length;
    } else {
      const idx = PS3_THEMES.findIndex(t => t.id === idOrIdx);
      if (idx !== -1) currentThemeIdx = idx;
    }
    const theme = PS3_THEMES[currentThemeIdx];
    try { localStorage.setItem('ps3_wave_color', theme.id); } catch {}
    updateWaveLabel();
    if (window.ps3WaveImpulse) window.ps3WaveImpulse();
    return theme;
  };

  window.cyclePs3WaveColor = () => {
    return window.setPs3WaveColor(currentThemeIdx + 1);
  };

  window.getPs3WaveTheme = () => PS3_THEMES[currentThemeIdx];

  window.addEventListener('DOMContentLoaded', updateWaveLabel);

  /* -- ПРЕДРАСЧИТАННЫЕ КЭШ-ТЕКСТУРЫ (OFFSCREEN) -- */
  const moteCanvas = document.createElement('canvas');
  moteCanvas.width = 32;
  moteCanvas.height = 32;
  const mCtx = moteCanvas.getContext('2d');
  const mGrad = mCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  mGrad.addColorStop(0, 'rgba(255,255,255,1)');
  mGrad.addColorStop(0.35, 'rgba(185,230,255,0.78)');
  mGrad.addColorStop(0.7, 'rgba(120,190,255,0.25)');
  mGrad.addColorStop(1, 'rgba(80,160,255,0)');
  mCtx.fillStyle = mGrad;
  mCtx.fillRect(0, 0, 32, 32);

  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.width = 32;
  sparkCanvas.height = 32;
  const sCtx = sparkCanvas.getContext('2d');
  const sGrad = sCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  sGrad.addColorStop(0, 'rgba(255,255,255,1)');
  sGrad.addColorStop(0.35, 'rgba(160,225,255,0.85)');
  sGrad.addColorStop(0.75, 'rgba(80,160,255,0.3)');
  sGrad.addColorStop(1, 'rgba(40,110,240,0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 32, 32);

  /* -- МЫШЬ И ПАРАЛЛАКС -- */
  let mouseX = -9999, mouseY = -9999;
  let targetMX = 0, targetMY = 0;
  let smoothMX = 0, smoothMY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    targetMX = (e.clientX / (W || 1) - 0.5) * 2;
    targetMY = (e.clientY / (H || 1) - 0.5) * 2;
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    mouseX = -9999;
    mouseY = -9999;
  });

  /* -- ПЫЛИНКИ PS3 DUST MOTES -- */
  const DUST_COUNT = 42;
  const dust = [];
  const makeDust = (forceBottom) => ({
    x: Math.random() * W,
    y: forceBottom ? H + Math.random() * 30 : Math.random() * H,
    r: Math.random() * 1.7 + 0.55,
    vy: -(Math.random() * 0.28 + 0.08),
    vx: (Math.random() - 0.5) * 0.15,
    baseAlpha: Math.random() * 0.45 + 0.22,
    phaseSeed: Math.random() * Math.PI * 2,
    twinkle: Math.random() * 0.014 + 0.005,
  });

  /* -- ВОЛНЫ PS3 XMB SILK RIBBONS -- */
  const waves = [
    {
      baseY: 0.57,
      speed: 0.0068,
      harmonics: [
        { freq: 0.0015, amp: 54, phase: 0 },
        { freq: 0.0032, amp: 26, phase: 1.2 },
        { freq: 0.0008, amp: 20, phase: 2.5 }
      ]
    },
    {
      baseY: 0.51,
      speed: -0.0056,
      harmonics: [
        { freq: 0.0018, amp: 46, phase: 2.0 },
        { freq: 0.0039, amp: 22, phase: 0.5 },
        { freq: 0.0010, amp: 18, phase: 3.1 }
      ]
    },
    {
      baseY: 0.64,
      speed: 0.0048,
      harmonics: [
        { freq: 0.0012, amp: 62, phase: 1.0 },
        { freq: 0.0026, amp: 30, phase: 2.8 },
        { freq: 0.0006, amp: 24, phase: 0.2 }
      ]
    }
  ];

  const waveY = (wd, x, t) => {
    let y = H * wd.baseY;
    for (const h of wd.harmonics) y += Math.sin(x * h.freq + t * wd.speed + h.phase) * h.amp;
    return y;
  };

  const SPARK_PER_WAVE = 7;
  const sparks = [];
  const makeSpark = (wIdx, t) => {
    const x = Math.random() * W;
    const y = waveY(waves[wIdx], x, t);
    return {
      wIdx, x, y,
      life: 0,
      maxLife: 48 + Math.floor(Math.random() * 52),
      vx: (Math.random() - 0.5) * 1.4,
      vy: -(Math.random() * 1.0 + 0.22),
      size: Math.random() * 1.5 + 0.7,
    };
  };

  /* -- КЛИК-СПАРКИ -- */
  const clickBursts = [];
  const triggerBurst = (bx, by, count = 14) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.2 + 1.0;
      clickBursts.push({
        x: bx,
        y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 28 + Math.floor(Math.random() * 18),
        size: Math.random() * 1.9 + 0.8,
      });
    }
  };

  window.addEventListener('pointerdown', (e) => {
    triggerBurst(e.clientX, e.clientY, 12);
  }, { passive: true });

  window.ps3ParticleBurst = (x, y, count) => triggerBurst(x, y, count);

  let impulse = 0;
  let time = 0;
  window.ps3WaveImpulse = () => {
    impulse = Math.min(impulse + 1.1, 2.2);
    waves.forEach((_, wIdx) => {
      for (let i = 0; i < 4; i++) sparks.push(makeSpark(wIdx, time));
    });
  };

  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dust.length = 0;
    for (let i = 0; i < DUST_COUNT; i++) dust.push(makeDust(false));

    sparks.length = 0;
    waves.forEach((_, wIdx) => {
      for (let i = 0; i < SPARK_PER_WAVE; i++) sparks.push(makeSpark(wIdx, 0));
    });
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });

  const animate = () => {
    time += 1;
    impulse *= 0.96;

    ctx.clearRect(0, 0, W, H);

    smoothMX += (targetMX - smoothMX) * 0.045;
    smoothMY += (targetMY - smoothMY) * 0.045;

    const theme = PS3_THEMES[currentThemeIdx] || PS3_THEMES[0];
    const hasPic1 = document.documentElement.classList.contains('has-pic1');
    const isLight = document.documentElement.dataset.theme === 'light';

    // 1. Фон PS3 (если активен PIC1.PNG арт игры — рисуем полупрозрачную вуаль, чтобы арт светился сквозь волны)
    ctx.save();
    if (hasPic1) {
      ctx.globalAlpha = 0.52;
    }
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (isLight) {
      bgGrad.addColorStop(0, '#1e40af');
      bgGrad.addColorStop(0.48, '#2563eb');
      bgGrad.addColorStop(0.82, '#1d4ed8');
      bgGrad.addColorStop(1, '#0f172a');
    } else {
      bgGrad.addColorStop(0, theme.sky[0]);
      bgGrad.addColorStop(0.45, theme.sky[1]);
      bgGrad.addColorStop(0.78, theme.sky[2]);
      bgGrad.addColorStop(1, theme.sky[3]);
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 2. Шёлковые ленты волн PS3 XMB (Additive Blending)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const boost = 1 + impulse * 0.42;
    const step = 10;

    for (let wIdx = 0; wIdx < waves.length; wIdx++) {
      const w = waves[wIdx];
      const cy = H * w.baseY + smoothMY * 12;

      ctx.beginPath();
      ctx.moveTo(0, H);

      const points = [];
      for (let x = 0; x <= W + step; x += step) {
        let yOffset = 0;
        for (let hi = 0; hi < w.harmonics.length; hi++) {
          const h = w.harmonics[hi];
          yOffset += Math.sin(x * h.freq + time * w.speed + h.phase) * (h.amp * boost);
        }
        const y = cy + yOffset;
        points.push({ x, y });
        ctx.lineTo(x, y);
      }

      ctx.lineTo(W, H);
      ctx.closePath();

      const waveGrad = ctx.createLinearGradient(0, cy - 85 * boost, 0, H);
      waveGrad.addColorStop(0, theme.wave0);
      waveGrad.addColorStop(0.32, theme.wave1);
      waveGrad.addColorStop(0.88, theme.wave2);
      ctx.fillStyle = waveGrad;
      ctx.fill();

      // Двойной шелковый контур гребня волны PS3
      ctx.beginPath();
      for (let pi = 0; pi < points.length; pi++) {
        const p = points[pi];
        if (pi === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = theme.strokeGlow;
      ctx.stroke();

      ctx.lineWidth = 1.4;
      ctx.strokeStyle = theme.strokeMain;
      ctx.stroke();
    }

    // 3. Искры на гребнях волн PS3
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      s.life++;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.032;
      if (s.life >= s.maxLife || s.y > H + 20 || s.x < -10 || s.x > W + 10) {
        sparks[i] = makeSpark(s.wIdx, time);
        continue;
      }
      const prog = s.life / s.maxLife;
      const a = prog < 0.2 ? prog / 0.2 : 1 - (prog - 0.2) / 0.8;
      const sz = s.size * 5.0;
      ctx.globalAlpha = a * 0.88;
      ctx.drawImage(sparkCanvas, s.x - sz / 2, s.y - sz / 2, sz, sz);
    }

    // 4. Клик-всплески
    if (clickBursts.length > 0) {
      for (let i = clickBursts.length - 1; i >= 0; i--) {
        const b = clickBursts[i];
        b.life++;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.94;
        b.vy *= 0.94;
        if (b.life >= b.maxLife) {
          clickBursts.splice(i, 1);
          continue;
        }
        const p = b.life / b.maxLife;
        const a = (1 - p) * 0.85;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size * (1 - p * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(185, 230, 255, ${a})`;
        ctx.fill();
      }
    }

    ctx.restore();

    // 5. Мерцающие пылинки PS3
    for (let i = 0; i < dust.length; i++) {
      const d = dust[i];
      d.x += d.vx;
      d.y += d.vy;
      d.phaseSeed += d.twinkle;
      if (d.y < -10) {
        Object.assign(d, makeDust(true));
        continue;
      }
      const pulse = 0.6 + 0.4 * Math.sin(time * d.twinkle + d.phaseSeed);
      const a = d.baseAlpha * pulse;
      const sz = d.r * 4.8;
      ctx.globalAlpha = a;
      ctx.drawImage(moteCanvas, d.x - sz / 2, d.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
})();
