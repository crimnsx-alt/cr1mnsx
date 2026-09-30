/**
 * ps3particles.js — PS3 XMB Particle System v3.0 (MacBook High-FPS Optimized)
 * --------------------------------------------------------------------------
 * Оптимизации для Retina экранов Mac:
 *   - DPR ограничен до 1.25 (уменьшение нагрузки на GPU на 60% без потери четкости)
 *   - Текстуры пылинок, спарков, ореола и глифов предрассчитаны на offscreen canvas
 *   - Исключен тяжелый ctx.filter='blur()' из анимационного цикла
 *   - Отрисовка 3 слоев звезд сгруппирована в единые батчи путей (3 draw call вместо 155)
 */
(() => {
  'use strict';

  /* -- Создаём canvas поверх ps3wave-canvas -- */
  const canvas = document.createElement('canvas');
  canvas.id = 'ps3ParticlesCanvas';
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;';

  const bg = document.querySelector('.bg');
  if (bg) bg.appendChild(canvas);
  else document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  // Для дисплеев Retina 1.25 дает идеальную четкость при вдвое меньшей нагрузке на GPU
  const DPR = Math.min(window.devicePixelRatio || 1, 1.25);
  let W = 0, H = 0;

  /* -- ПРЕДРАСЧЕТ СПРАЙТОВ (OFFSCREEN CANVASES) ДЛЯ 60-120 FPS -- */
  // 1. Текстура пылинки (Dust Mote) 32x32
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

  // 2. Текстура спарка гребня волны (Wave Spark) 32x32
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

  // 3. Предрассчитанные глифы PlayStation (✕, ○, □, △) 64x64
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

  // 4. Мягкий ореол курсора 128x128
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 128;
  haloCanvas.height = 128;
  const hCtx = haloCanvas.getContext('2d');
  const hGrad = hCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  hGrad.addColorStop(0, 'rgba(120,195,255,0.08)');
  hGrad.addColorStop(0.5, 'rgba(70,145,255,0.03)');
  hGrad.addColorStop(1, 'rgba(20,60,180,0)');
  hCtx.fillStyle = hGrad;
  hCtx.fillRect(0, 0, 128, 128);

  /* -- Мышь / параллакс -- */
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

  /* §1 DUST MOTES */
  const DUST_COUNT = 50;
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

  /* §2 WAVE CREST SPARKS */
  const WAVE_DEFS = [
    { baseY: 0.58, speed: 0.007, harmonics: [{ f: 0.0016, a: 55, p: 0 }, { f: 0.0034, a: 28, p: 1.2 }, { f: 0.0008, a: 20, p: 2.5 }] },
    { baseY: 0.52, speed: -0.006, harmonics: [{ f: 0.0019, a: 48, p: 2.0 }, { f: 0.0041, a: 24, p: 0.5 }, { f: 0.0011, a: 18, p: 3.1 }] },
    { baseY: 0.65, speed: 0.005, harmonics: [{ f: 0.0013, a: 65, p: 1.0 }, { f: 0.0027, a: 32, p: 2.8 }, { f: 0.0006, a: 25, p: 0.2 }] },
  ];

  const waveY = (wd, x, t) => {
    let y = H * wd.baseY;
    for (const h of wd.harmonics) y += Math.sin(x * h.f + t * wd.speed + h.p) * h.a;
    return y;
  };

  const SPARK_PER_WAVE = 7;
  const sparks = [];

  const makeSpark = (wIdx, t) => {
    const x = Math.random() * W;
    const y = waveY(WAVE_DEFS[wIdx], x, t);
    return {
      wIdx, x, y,
      life: 0,
      maxLife: 50 + Math.floor(Math.random() * 55),
      vx: (Math.random() - 0.5) * 1.6,
      vy: -(Math.random() * 1.1 + 0.25),
      size: Math.random() * 1.6 + 0.7,
    };
  };

  /* §3 CONSTELLATION */
  const MICRO_COUNT = 85;
  const CONNECT_RADIUS = 90;
  const micro = [];

  const makeMicro = () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.22,
    vy: (Math.random() - 0.5) * 0.22,
    r: Math.random() * 0.9 + 0.4,
    alpha: Math.random() * 0.35 + 0.1,
  });

  /* §4 PLAYSTATION GLYPHS */
  const GLYPH_COUNT = 14;
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

  /* §5 PARALLAX STAR FIELD */
  const STAR_LAYERS = [
    { count: 80, r: 0.7, color: 'rgba(205,230,255,0.48)', parallax: 0.012 },
    { count: 45, r: 1.1, color: 'rgba(215,235,255,0.42)', parallax: 0.024 },
    { count: 20, r: 1.6, color: 'rgba(230,245,255,0.36)', parallax: 0.040 },
  ];
  const starsByLayer = [[], [], []];

  /* §6 INTERACTIVE CLICK BURST SPARKS */
  const clickBursts = [];

  const triggerBurst = (bx, by, count = 16) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 1.2;
      clickBursts.push({
        x: bx,
        y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 32 + Math.floor(Math.random() * 22),
        size: Math.random() * 2.0 + 0.8,
        colorType: Math.random() > 0.4 ? 'cyan' : (Math.random() > 0.5 ? 'white' : 'gold'),
      });
    }
  };

  window.addEventListener('pointerdown', (e) => {
    triggerBurst(e.clientX, e.clientY, 15);
  }, { passive: true });

  window.ps3ParticleBurst = (x, y, count) => triggerBurst(x, y, count);

  /* -- RESIZE / INIT -- */
  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    dust.length = 0;
    for (let i = 0; i < DUST_COUNT; i++) dust.push(makeDust(false));

    micro.length = 0;
    for (let i = 0; i < MICRO_COUNT; i++) micro.push(makeMicro());

    glyphs.length = 0;
    for (let i = 0; i < GLYPH_COUNT; i++) glyphs.push(makeGlyph());

    STAR_LAYERS.forEach((layer, lIdx) => {
      starsByLayer[lIdx] = [];
      for (let i = 0; i < layer.count; i++) {
        const bx = Math.random() * W;
        const by = Math.random() * H;
        starsByLayer[lIdx].push({ baseX: bx, baseY: by, x: bx, y: by });
      }
    });

    sparks.length = 0;
    WAVE_DEFS.forEach((_, wIdx) => {
      for (let i = 0; i < SPARK_PER_WAVE; i++) sparks.push(makeSpark(wIdx, 0));
    });
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* -- RENDER LOOP -- */
  let t = 0;

  const draw = () => {
    t++;
    ctx.clearRect(0, 0, W, H);

    smoothMX += (targetMX - smoothMX) * 0.045;
    smoothMY += (targetMY - smoothMY) * 0.045;

    /* §5 Stars — батч-отрисовка по слоям (3 вызова fill вместо 150) */
    STAR_LAYERS.forEach((layer, lIdx) => {
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
    });

    /* Мягкий световой ореол вокруг курсора из предрассчитанного спрайта */
    if (mouseX > 0 && mouseY > 0) {
      const hSize = 220;
      ctx.drawImage(haloCanvas, mouseX - hSize / 2, mouseY - hSize / 2, hSize, hSize);
    }

    /* §1 Dust Motes с аппаратным спрайтом */
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
      const pulse = 0.6 + 0.4 * Math.sin(t * d.twinkle + d.phaseSeed);
      const a = d.baseAlpha * pulse;
      const sz = d.r * 5.2;
      ctx.globalAlpha = a;
      ctx.drawImage(moteCanvas, d.x - sz / 2, d.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;

    /* §2 Wave Crest Sparks с аппаратным спрайтом */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      s.life++;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.035;
      if (s.life >= s.maxLife || s.y > H + 20 || s.x < -10 || s.x > W + 10) {
        sparks[i] = makeSpark(s.wIdx, t);
        continue;
      }
      const prog = s.life / s.maxLife;
      const a = prog < 0.2 ? prog / 0.2 : 1 - (prog - 0.2) / 0.8;
      const sz = s.size * 5.5;
      ctx.globalAlpha = a * 0.95;
      ctx.drawImage(sparkCanvas, s.x - sz / 2, s.y - sz / 2, sz, sz);
    }
    ctx.restore();

    /* §6 Interactive Click Bursts */
    if (clickBursts.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
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
      ctx.restore();
    }

    /* §4 PS Glyphs — без дорогого ctx.filter, используем предрассчитанные кэш-канвасы */
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

    /* §3 Constellation */
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
            if (dSq > 4900) continue;
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

    requestAnimationFrame(draw);
  };

  requestAnimationFrame(draw);

  /* API: импульс спарков при смене разделов/пунктов */
  const _orig = window.ps3WaveImpulse;
  window.ps3WaveImpulse = () => {
    if (_orig) _orig();
    WAVE_DEFS.forEach((_, wIdx) => {
      for (let i = 0; i < 6; i++) sparks.push(makeSpark(wIdx, t));
    });
    const spawnX = Math.min(W * 0.28, 380);
    const spawnY = H * 0.38;
    triggerBurst(spawnX, spawnY, 8);
  };
})();
