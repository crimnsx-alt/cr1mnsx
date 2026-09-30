/**
 * ps3wave.js — Unified PS3 XMB Engine v4.0 (Ultra-Performance 60-120 FPS)
 * ------------------------------------------------------------------------
 * Объединенный движок: волны PS3 XMB + звездное поле + пылинки + созвездия + глифы
 * Всё рисуется на ОДНОМ Canvas в ОДНОМ анимационном цикле с аппаратным ускорением.
 * На дисплеях Retina Mac работает на 60–120 FPS без просадок и нагрева.
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
    bgContainer.prepend(canvas);
  } else {
    document.body.prepend(canvas);
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  // На экранах Retina DPR 1.0 дает идеальную шелковистую мягкость волн и 4-кратную экономию GPU
  const dpr = 1.0;
  let W = 0, H = 0;

  /* -- ПРЕДРАСЧИТАННЫЕ КЭШ-ТЕКСТУРЫ (OFFSCREEN) -- */
  // 1. Пылинка PS3
  const moteCanvas = document.createElement('canvas');
  moteCanvas.width = 32;
  moteCanvas.height = 32;
  const mCtx = moteCanvas.getContext('2d');
  const mGrad = mCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  mGrad.addColorStop(0, 'rgba(255,255,255,1)');
  mGrad.addColorStop(0.35, 'rgba(165,220,255,0.75)');
  mGrad.addColorStop(0.7, 'rgba(100,180,255,0.25)');
  mGrad.addColorStop(1, 'rgba(80,160,255,0)');
  mCtx.fillStyle = mGrad;
  mCtx.fillRect(0, 0, 32, 32);

  // 2. Искра гребня волны
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.width = 32;
  sparkCanvas.height = 32;
  const sCtx = sparkCanvas.getContext('2d');
  const sGrad = sCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  sGrad.addColorStop(0, 'rgba(255,255,255,1)');
  sGrad.addColorStop(0.35, 'rgba(120,210,255,0.85)');
  sGrad.addColorStop(0.75, 'rgba(60,140,255,0.3)');
  sGrad.addColorStop(1, 'rgba(40,110,240,0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 32, 32);

  // 3. Глифы кнопок PlayStation (✕, ○, □, △)
  const PS_GLYPHS = ['\u2715', '\u25cb', '\u25a1', '\u25b3'];
  const PS_COLORS = ['rgba(130,180,255,', 'rgba(240,115,135,', 'rgba(170,220,255,', 'rgba(150,235,170,'];
  const cachedGlyphs = PS_GLYPHS.map((glyph, idx) => {
    const gCan = document.createElement('canvas');
    gCan.width = 64;
    gCan.height = 64;
    const gCtx = gCan.getContext('2d');
    gCtx.font = '28px sans-serif';
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'middle';
    gCtx.shadowColor = PS_COLORS[idx] + '0.85)';
    gCtx.shadowBlur = 8;
    gCtx.fillStyle = PS_COLORS[idx] + '0.95)';
    gCtx.fillText(glyph, 32, 32);
    return gCan;
  });

  // 4. Ореол курсора
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 128;
  haloCanvas.height = 128;
  const hCtx = haloCanvas.getContext('2d');
  const hGrad = hCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  hGrad.addColorStop(0, 'rgba(120,195,255,0.07)');
  hGrad.addColorStop(0.5, 'rgba(70,145,255,0.025)');
  hGrad.addColorStop(1, 'rgba(20,60,180,0)');
  hCtx.fillStyle = hGrad;
  hCtx.fillRect(0, 0, 128, 128);

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

  /* -- ЗВЕЗДНОЕ ПОЛЕ (3 СЛОЯ) -- */
  const STAR_LAYERS = [
    { count: 70, r: 0.7, color: 'rgba(205,230,255,0.45)', parallax: 0.012 },
    { count: 40, r: 1.1, color: 'rgba(215,235,255,0.40)', parallax: 0.024 },
    { count: 18, r: 1.6, color: 'rgba(230,245,255,0.35)', parallax: 0.038 },
  ];
  const starsByLayer = [[], [], []];

  /* -- ПЫЛИНКИ PS3 DUST MOTES -- */
  const DUST_COUNT = 45;
  const dust = [];
  const makeDust = (forceBottom) => ({
    x: Math.random() * W,
    y: forceBottom ? H + Math.random() * 30 : Math.random() * H,
    r: Math.random() * 1.8 + 0.6,
    vy: -(Math.random() * 0.32 + 0.1),
    vx: (Math.random() - 0.5) * 0.16,
    baseAlpha: Math.random() * 0.45 + 0.25,
    phaseSeed: Math.random() * Math.PI * 2,
    twinkle: Math.random() * 0.014 + 0.005,
  });

  /* -- ВОЛНЫ PS3 -- */
  const waves = [
    {
      baseY: 0.58,
      speed: 0.007,
      colorStop0: 'rgba(255, 255, 255, 0.42)',
      colorStop1: 'rgba(50, 150, 255, 0.22)',
      colorStop2: 'rgba(10, 50, 130, 0.01)',
      strokeColor: 'rgba(255, 255, 255, 0.55)',
      harmonics: [
        { freq: 0.0016, amp: 55, phase: 0 },
        { freq: 0.0034, amp: 28, phase: 1.2 },
        { freq: 0.0008, amp: 20, phase: 2.5 }
      ]
    },
    {
      baseY: 0.52,
      speed: -0.006,
      colorStop0: 'rgba(220, 245, 255, 0.35)',
      colorStop1: 'rgba(30, 110, 230, 0.18)',
      colorStop2: 'rgba(5, 30, 90, 0.01)',
      strokeColor: 'rgba(210, 240, 255, 0.48)',
      harmonics: [
        { freq: 0.0019, amp: 48, phase: 2.0 },
        { freq: 0.0041, amp: 24, phase: 0.5 },
        { freq: 0.0011, amp: 18, phase: 3.1 }
      ]
    },
    {
      baseY: 0.65,
      speed: 0.005,
      colorStop0: 'rgba(200, 240, 255, 0.28)',
      colorStop1: 'rgba(20, 90, 210, 0.14)',
      colorStop2: 'rgba(2, 20, 60, 0.0)',
      strokeColor: 'rgba(180, 220, 255, 0.38)',
      harmonics: [
        { freq: 0.0013, amp: 65, phase: 1.0 },
        { freq: 0.0027, amp: 32, phase: 2.8 },
        { freq: 0.0006, amp: 25, phase: 0.2 }
      ]
    }
  ];

  /* -- СПАРКИ ГРЕБНЕЙ ВОЛН -- */
  const waveY = (wd, x, t) => {
    let y = H * wd.baseY;
    for (const h of wd.harmonics) y += Math.sin(x * h.freq + t * wd.speed + h.phase) * h.amp;
    return y;
  };

  const SPARK_PER_WAVE = 6;
  const sparks = [];
  const makeSpark = (wIdx, t) => {
    const x = Math.random() * W;
    const y = waveY(waves[wIdx], x, t);
    return {
      wIdx, x, y,
      life: 0,
      maxLife: 45 + Math.floor(Math.random() * 50),
      vx: (Math.random() - 0.5) * 1.6,
      vy: -(Math.random() * 1.1 + 0.25),
      size: Math.random() * 1.6 + 0.7,
    };
  };

  /* -- ГЛИФЫ КНОПОК PLAYSTATION -- */
  const GLYPH_COUNT = 12;
  const glyphs = [];
  const makeGlyph = () => ({
    idx: Math.floor(Math.random() * PS_GLYPHS.length),
    x: Math.random() * W,
    y: Math.random() * H,
    size: Math.random() * 20 + 13,
    alpha: Math.random() * 0.14 + 0.04,
    rotSpeed: (Math.random() - 0.5) * 0.007,
    rot: Math.random() * Math.PI * 2,
    vy: -(Math.random() * 0.15 + 0.04),
  });

  /* -- СОЗВЕЗДИЯ КУРСОРА -- */
  const MICRO_COUNT = 75;
  const CONNECT_RADIUS = 88;
  const micro = [];
  const makeMicro = () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.22,
    vy: (Math.random() - 0.5) * 0.22,
    r: Math.random() * 0.9 + 0.4,
  });

  /* -- КЛИК-СПАРКИ -- */
  const clickBursts = [];
  const triggerBurst = (bx, by, count = 16) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.4 + 1.2;
      clickBursts.push({
        x: bx,
        y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 30 + Math.floor(Math.random() * 20),
        size: Math.random() * 2.0 + 0.8,
        colorType: Math.random() > 0.4 ? 'cyan' : (Math.random() > 0.5 ? 'white' : 'gold'),
      });
    }
  };

  window.addEventListener('pointerdown', (e) => {
    triggerBurst(e.clientX, e.clientY, 14);
  }, { passive: true });

  window.ps3ParticleBurst = (x, y, count) => triggerBurst(x, y, count);

  let impulse = 0;
  window.ps3WaveImpulse = () => {
    impulse = Math.min(impulse + 1.2, 2.5);
    waves.forEach((_, wIdx) => {
      for (let i = 0; i < 5; i++) sparks.push(makeSpark(wIdx, time));
    });
    const spawnX = Math.min(W * 0.28, 380);
    const spawnY = H * 0.38;
    triggerBurst(spawnX, spawnY, 8);
  };

  /* -- RESIZE -- */
  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    STAR_LAYERS.forEach((layer, lIdx) => {
      starsByLayer[lIdx] = [];
      for (let i = 0; i < layer.count; i++) {
        const bx = Math.random() * W;
        const by = Math.random() * H;
        starsByLayer[lIdx].push({ baseX: bx, baseY: by, x: bx, y: by });
      }
    });

    dust.length = 0;
    for (let i = 0; i < DUST_COUNT; i++) dust.push(makeDust(false));

    glyphs.length = 0;
    for (let i = 0; i < GLYPH_COUNT; i++) glyphs.push(makeGlyph());

    micro.length = 0;
    for (let i = 0; i < MICRO_COUNT; i++) micro.push(makeMicro());

    sparks.length = 0;
    waves.forEach((_, wIdx) => {
      for (let i = 0; i < SPARK_PER_WAVE; i++) sparks.push(makeSpark(wIdx, 0));
    });
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* -- ЕДИНЫЙ ВЫСОКОСКОРОСТНОЙ ЦИКЛ РЕНДЕРИНГА -- */
  let time = 0;

  const animate = () => {
    time += 1;
    impulse *= 0.96;

    ctx.clearRect(0, 0, W, H);

    smoothMX += (targetMX - smoothMX) * 0.045;
    smoothMY += (targetMY - smoothMY) * 0.045;

    // 1. Градиент ночного космоса PS3
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#061328');
    bgGrad.addColorStop(0.45, '#0b2654');
    bgGrad.addColorStop(0.75, '#071b3e');
    bgGrad.addColorStop(1, '#020713');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Звезды (3 батч-вызова fill)
    for (let lIdx = 0; lIdx < STAR_LAYERS.length; lIdx++) {
      const layer = STAR_LAYERS[lIdx];
      const arr = starsByLayer[lIdx];
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        s.x = s.baseX + smoothMX * layer.parallax * W;
        s.y = s.baseY + smoothMY * layer.parallax * H;
        ctx.moveTo(s.x + layer.r, s.y);
        ctx.arc(s.x, s.y, layer.r, 0, Math.PI * 2);
      }
      ctx.fillStyle = layer.color;
      ctx.fill();
    }

    // 3. Волны PS3 (Additive Blending)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const boost = 1 + impulse * 0.45;
    const step = 10;

    for (let wIdx = 0; wIdx < waves.length; wIdx++) {
      const w = waves[wIdx];
      const cy = H * w.baseY;

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

      const waveGrad = ctx.createLinearGradient(0, cy - 80 * boost, 0, H);
      waveGrad.addColorStop(0, w.colorStop0);
      waveGrad.addColorStop(0.3, w.colorStop1);
      waveGrad.addColorStop(0.85, w.colorStop2);
      ctx.fillStyle = waveGrad;
      ctx.fill();

      // Двойной контур гребня (без дорогого shadowBlur)
      ctx.beginPath();
      for (let pi = 0; pi < points.length; pi++) {
        const p = points[pi];
        if (pi === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.lineWidth = 3.6;
      ctx.strokeStyle = 'rgba(128, 195, 255, 0.28)';
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = w.strokeColor;
      ctx.stroke();
    }

    // 4. Спарки гребней волн
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      s.life++;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.035;
      if (s.life >= s.maxLife || s.y > H + 20 || s.x < -10 || s.x > W + 10) {
        sparks[i] = makeSpark(s.wIdx, time);
        continue;
      }
      const prog = s.life / s.maxLife;
      const a = prog < 0.2 ? prog / 0.2 : 1 - (prog - 0.2) / 0.8;
      const sz = s.size * 5.2;
      ctx.globalAlpha = a * 0.9;
      ctx.drawImage(sparkCanvas, s.x - sz / 2, s.y - sz / 2, sz, sz);
    }

    // 5. Клик-всплески искр
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
        const color = b.colorType === 'cyan'
          ? `rgba(120,210,255,${a})`
          : (b.colorType === 'gold' ? `rgba(255,210,130,${a})` : `rgba(255,255,255,${a})`);

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size * (1 - p * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    ctx.restore();

    // 6. Ореол курсора
    if (mouseX > 0 && mouseY > 0) {
      const hSize = 220;
      ctx.drawImage(haloCanvas, mouseX - hSize / 2, mouseY - hSize / 2, hSize, hSize);
    }

    // 7. Пылинки PS3
    for (let i = 0; i < dust.length; i++) {
      const d = dust[i];
      if (mouseX > 0) {
        const dx = d.x - mouseX;
        const dy = d.y - mouseY;
        const distSq = dx * dx + dy * dy;
        if (distSq < 8100 && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / 90) * 0.38;
          d.x += (dx / dist) * force;
          d.y += (dy / dist) * force;
        }
      }

      d.x += d.vx;
      d.y += d.vy;
      d.phaseSeed += d.twinkle;
      if (d.y < -10) {
        Object.assign(d, makeDust(true));
        continue;
      }
      const pulse = 0.6 + 0.4 * Math.sin(time * d.twinkle + d.phaseSeed);
      const a = d.baseAlpha * pulse;
      const sz = d.r * 5.0;
      ctx.globalAlpha = a;
      ctx.drawImage(moteCanvas, d.x - sz / 2, d.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;

    // 8. Глифы кнопок PlayStation
    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i];
      g.y += g.vy;
      g.rot += g.rotSpeed;
      if (g.y < -30) Object.assign(g, makeGlyph(), { y: H + 30 });
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rot);
      ctx.globalAlpha = g.alpha;
      const s = g.size * 1.8;
      ctx.drawImage(cachedGlyphs[g.idx], -s / 2, -s / 2, s, s);
      ctx.restore();
    }

    // 9. Созвездия курсора
    ctx.beginPath();
    for (let i = 0; i < micro.length; i++) {
      const m = micro[i];
      m.x += m.vx;
      m.y += m.vy;
      if (m.x < 0) m.x = W;
      if (m.x > W) m.x = 0;
      if (m.y < 0) m.y = H;
      if (m.y > H) m.y = 0;
      ctx.moveTo(m.x + m.r, m.y);
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    }
    ctx.fillStyle = 'rgba(200,230,255,0.28)';
    ctx.fill();

    if (mouseX > 0) {
      const near = [];
      for (let i = 0; i < micro.length; i++) {
        const m = micro[i];
        const dx = m.x - mouseX, dy = m.y - mouseY;
        if (dx * dx + dy * dy < CONNECT_RADIUS * CONNECT_RADIUS) near.push(m);
      }
      if (near.length > 0) {
        ctx.beginPath();
        for (let i = 0; i < near.length; i++) {
          for (let j = i + 1; j < near.length; j++) {
            const dx = near[i].x - near[j].x, dy = near[i].y - near[j].y;
            const dSq = dx * dx + dy * dy;
            if (dSq > 4600) continue;
            ctx.moveTo(near[i].x, near[i].y);
            ctx.lineTo(near[j].x, near[j].y);
          }
        }
        ctx.strokeStyle = 'rgba(180,220,255,0.14)';
        ctx.lineWidth = 0.55;
        ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i < near.length; i++) {
          ctx.moveTo(mouseX, mouseY);
          ctx.lineTo(near[i].x, near[i].y);
        }
        ctx.strokeStyle = 'rgba(220,240,255,0.1)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
})();
