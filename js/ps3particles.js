/**
 * ps3particles.js — PS3 XMB Particle System v2.5 Enhanced
 * --------------------------------------------------------
 * Слои (все на одном Canvas поверх ps3wave.js):
 *   1. Dust Motes            — мягкие светящиеся пылинки с мерцанием и реакцией на курсор
 *   2. Wave Crest Sparks     — импульсы вдоль гребней волн
 *   3. Constellation         — микро-точки + линии в радиусе курсора + световой ореол
 *   4. PS Button Glyphs      — ✕, ○, □, △ с blur-rotation на дальнем плане
 *   5. Parallax Star Field   — 3 слоя звёзд, плавный параллакс по мышке
 *   6. Interactive Sparks    — радиальный взрыв искр при кликах и навигации XMB
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

  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;

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
  const DUST_COUNT = 60;
  const dust = [];

  const makeDust = (forceBottom) => ({
    x: Math.random() * W,
    y: forceBottom ? H + Math.random() * 40 : Math.random() * H,
    r: Math.random() * 2.0 + 0.6,
    vy: -(Math.random() * 0.35 + 0.1),
    vx: (Math.random() - 0.5) * 0.18,
    baseAlpha: Math.random() * 0.45 + 0.25,
    pulseFreq: Math.random() * 0.018 + 0.006,
    phaseSeed: Math.random() * Math.PI * 2,
    twinkle: Math.random() * 0.013 + 0.004,
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

  const SPARK_PER_WAVE = 8;
  const sparks = [];

  const makeSpark = (wIdx, t) => {
    const x = Math.random() * W;
    const y = waveY(WAVE_DEFS[wIdx], x, t);
    return {
      wIdx, x, y,
      life: 0,
      maxLife: 55 + Math.floor(Math.random() * 65),
      vx: (Math.random() - 0.5) * 1.8,
      vy: -(Math.random() * 1.2 + 0.3),
      size: Math.random() * 1.8 + 0.7,
    };
  };

  /* §3 CONSTELLATION */
  const MICRO_COUNT = 95;
  const CONNECT_RADIUS = 95;
  const micro = [];

  const makeMicro = () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.24,
    vy: (Math.random() - 0.5) * 0.24,
    r: Math.random() * 0.95 + 0.45,
    alpha: Math.random() * 0.35 + 0.1,
  });

  /* §4 PLAYSTATION GLYPHS */
  const PS_GLYPHS  = ['\u2715', '\u25cb', '\u25a1', '\u25b3'];
  const PS_COLORS  = ['rgba(120,170,255,', 'rgba(235,110,130,', 'rgba(160,210,255,', 'rgba(140,230,160,'];
  const GLYPH_COUNT = 15;
  const glyphs = [];

  const makeGlyph = () => {
    const idx = Math.floor(Math.random() * PS_GLYPHS.length);
    return {
      idx,
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 20 + 13,
      alpha: Math.random() * 0.13 + 0.035,
      rotSpeed: (Math.random() - 0.5) * 0.007,
      rot: Math.random() * Math.PI * 2,
      vy: -(Math.random() * 0.16 + 0.04),
    };
  };

  /* §5 PARALLAX STAR FIELD */
  const STAR_LAYERS = [
    { count: 85, r: 0.7, alpha: 0.55, parallax: 0.012, twinkle: 0.012 },
    { count: 50, r: 1.15, alpha: 0.45, parallax: 0.025, twinkle: 0.008 },
    { count: 22, r: 1.65, alpha: 0.38, parallax: 0.042, twinkle: 0.005 },
  ];
  const stars = [];

  /* §6 INTERACTIVE CLICK BURST SPARKS */
  const clickBursts = [];

  const triggerBurst = (bx, by, count = 18) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.8 + 1.2;
      clickBursts.push({
        x: bx,
        y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 35 + Math.floor(Math.random() * 25),
        size: Math.random() * 2.2 + 0.8,
        colorType: Math.random() > 0.4 ? 'cyan' : (Math.random() > 0.5 ? 'white' : 'gold'),
      });
    }
  };

  window.addEventListener('pointerdown', (e) => {
    triggerBurst(e.clientX, e.clientY, 16);
  }, { passive: true });

  window.ps3ParticleBurst = (x, y, count) => triggerBurst(x, y, count);

  /* -- RESIZE / INIT -- */
  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    dust.length = 0;
    for (let i = 0; i < DUST_COUNT; i++) dust.push(makeDust(false));

    micro.length = 0;
    for (let i = 0; i < MICRO_COUNT; i++) micro.push(makeMicro());

    glyphs.length = 0;
    for (let i = 0; i < GLYPH_COUNT; i++) glyphs.push(makeGlyph());

    stars.length = 0;
    STAR_LAYERS.forEach((layer, lIdx) => {
      for (let i = 0; i < layer.count; i++) {
        const bx = Math.random() * W;
        const by = Math.random() * H;
        stars.push({ lIdx, x: bx, y: by, baseX: bx, baseY: by, phase: Math.random() * Math.PI * 2 });
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

    /* §5 Stars */
    stars.forEach((s) => {
      const layer = STAR_LAYERS[s.lIdx];
      const tw = 0.5 + 0.5 * Math.sin(t * layer.twinkle + s.phase);
      s.x = s.baseX + smoothMX * layer.parallax * W;
      s.y = s.baseY + smoothMY * layer.parallax * H;

      ctx.beginPath();
      ctx.arc(s.x, s.y, layer.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(210,235,255,' + (layer.alpha * tw) + ')';
      ctx.fill();
    });

    /* Мягкий световой ореол вокруг курсора */
    if (mouseX > 0 && mouseY > 0) {
      const halo = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 120);
      halo.addColorStop(0, 'rgba(120, 190, 255, 0.07)');
      halo.addColorStop(0.5, 'rgba(70, 140, 255, 0.025)');
      halo.addColorStop(1, 'rgba(20, 60, 180, 0)');
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 120, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();
    }

    /* §1 Dust Motes с реакцией на курсор */
    dust.forEach((d) => {
      // Плавное отталкивание курсором (эффект присутствия в пространстве)
      if (mouseX > 0) {
        const dx = d.x - mouseX;
        const dy = d.y - mouseY;
        const distSq = dx * dx + dy * dy;
        if (distSq < 10000 && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / 100) * 0.42;
          d.x += (dx / dist) * force;
          d.y += (dy / dist) * force;
        }
      }

      d.x += d.vx;
      d.y += d.vy;
      d.phaseSeed += d.twinkle;
      if (d.y < -10) {
        Object.assign(d, makeDust(true));
        return;
      }
      const pulse = 0.55 + 0.45 * Math.sin(t * d.twinkle + d.phaseSeed);
      const a = d.baseAlpha * pulse;
      const rad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 2.5);
      rad.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      rad.addColorStop(0.5, 'rgba(160,220,255,' + (a * 0.5) + ')');
      rad.addColorStop(1, 'rgba(100,180,255,0)');
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = rad;
      ctx.fill();
    });

    /* §2 Wave Crest Sparks */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    sparks.forEach((s, i) => {
      s.life++;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.035;
      if (s.life >= s.maxLife || s.y > H + 20 || s.x < -10 || s.x > W + 10) {
        sparks[i] = makeSpark(s.wIdx, t);
        return;
      }
      const prog = s.life / s.maxLife;
      const a = prog < 0.2 ? prog / 0.2 : 1 - (prog - 0.2) / 0.8;
      const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 2.5);
      grd.addColorStop(0, 'rgba(255,255,255,' + (a * 0.95) + ')');
      grd.addColorStop(0.4, 'rgba(100,200,255,' + (a * 0.55) + ')');
      grd.addColorStop(1, 'rgba(60,140,255,0)');
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    });

    /* §6 Interactive Click Bursts */
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

    /* §4 PS Glyphs */
    ctx.save();
    glyphs.forEach((g) => {
      g.y += g.vy;
      g.rot += g.rotSpeed;
      if (g.y < -30) Object.assign(g, makeGlyph(), { y: H + 30 });
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rot);
      ctx.filter = 'blur(2.8px)';
      ctx.font = g.size + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PS_COLORS[g.idx] + g.alpha + ')';
      ctx.fillText(PS_GLYPHS[g.idx], 0, 0);
      ctx.filter = 'none';
      ctx.restore();
    });
    ctx.restore();

    /* §3 Constellation */
    micro.forEach((m) => {
      m.x += m.vx;
      m.y += m.vy;
      if (m.x < 0) m.x = W;
      if (m.x > W) m.x = 0;
      if (m.y < 0) m.y = H;
      if (m.y > H) m.y = 0;
      const dx = m.x - mouseX, dy = m.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const prox = dist < CONNECT_RADIUS ? 1 - dist / CONNECT_RADIUS : 0;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,230,255,' + (m.alpha + prox * 0.35) + ')';
      ctx.fill();
    });

    if (mouseX > 0) {
      const near = micro.filter((m) => {
        const dx = m.x - mouseX, dy = m.y - mouseY;
        return dx * dx + dy * dy < CONNECT_RADIUS * CONNECT_RADIUS;
      });
      for (let i = 0; i < near.length; i++) {
        for (let j = i + 1; j < near.length; j++) {
          const dx = near[i].x - near[j].x, dy = near[i].y - near[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 72) continue;
          ctx.beginPath();
          ctx.moveTo(near[i].x, near[i].y);
          ctx.lineTo(near[j].x, near[j].y);
          ctx.strokeStyle = 'rgba(180,220,255,' + ((1 - d / 72) * 0.2) + ')';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      near.forEach((m) => {
        const dx = m.x - mouseX, dy = m.y - mouseY;
        const d = Math.sqrt(dx * dx + dy * dy);
        ctx.beginPath();
        ctx.moveTo(mouseX, mouseY);
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = 'rgba(220,240,255,' + ((1 - d / CONNECT_RADIUS) * 0.14) + ')';
        ctx.lineWidth = 0.55;
        ctx.stroke();
      });
    }

    requestAnimationFrame(draw);
  };

  requestAnimationFrame(draw);

  /* API: доп. спарки при смене раздела */
  const _orig = window.ps3WaveImpulse;
  window.ps3WaveImpulse = () => {
    if (_orig) _orig();
    WAVE_DEFS.forEach((_, wIdx) => {
      for (let i = 0; i < 7; i++) sparks.push(makeSpark(wIdx, t));
    });
    // Лёгкий всплеск искр в рабочей зоне меню
    const spawnX = Math.min(W * 0.28, 380);
    const spawnY = H * 0.38;
    triggerBurst(spawnX, spawnY, 8);
  };
})();
