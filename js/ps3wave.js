/**
 * PlayStation 5 Ambient HDR Light & Golden Bokeh Particle Engine (v6.0)
 *
 * Authentic Sony PlayStation 5 Home / Welcome Hub Background:
 *  - Volumetric HDR diagonal light beams radiating from upper-right
 *  - Floating PS5 golden-amber & ice-blue bokeh dust particles
 *  - 6 official PS5 DualSense / Console Cover themes:
 *      1. 'blue'     — PS5 Classic Blue & Gold (Original Boot Aura)
 *      2. 'ruby'     — Spider-Man / Volcanic Red
 *      3. 'amethyst' — Galactic Purple
 *      4. 'emerald'  — Aurora / Horizon Emerald
 *      5. 'gold'     — Astro Bot Amber Gold
 *      6. 'onyx'     — Midnight Black & Silver
 *  - Dynamic Game Hub Artwork mode (`html.has-pic1`): translucent HDR aura
 *    + bokeh particles floating over the selected game's 4K backdrop.
 */
(() => {
  'use strict';

  const bgContainer = document.querySelector('.bg');
  if (!bgContainer) return;

  const oldCanvas = document.getElementById('ps3WaveCanvas');
  if (oldCanvas) oldCanvas.remove();

  const canvas = document.createElement('canvas');
  canvas.id = 'ps3WaveCanvas';
  canvas.className = 'ps3-wave-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  bgContainer.prepend(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const THEME_ORDER = ['blue', 'ruby', 'amethyst', 'emerald', 'gold', 'onyx'];

  const THEMES = {
    blue: {
      id: 'blue',
      name: 'PS5 Синяя',
      topBg: '#03091c',
      midBg: '#061a44',
      botBg: '#02050f',
      auraPrimary: [0, 112, 209],     // Official PS5 Blue
      auraSecondary: [56, 189, 248],  // Ice Cyan
      particleGold: [251, 191, 36],   // PS5 Boot Gold Bokeh
      particleCool: [147, 197, 253],
    },
    ruby: {
      id: 'ruby',
      name: 'Volcanic Red',
      topBg: '#19040b',
      midBg: '#3f0a19',
      botBg: '#090205',
      auraPrimary: [225, 29, 72],
      auraSecondary: [251, 113, 133],
      particleGold: [253, 224, 71],
      particleCool: [254, 205, 211],
    },
    amethyst: {
      id: 'amethyst',
      name: 'Galactic Purple',
      topBg: '#0e0520',
      midBg: '#271052',
      botBg: '#05020d',
      auraPrimary: [147, 51, 234],
      auraSecondary: [192, 132, 252],
      particleGold: [250, 204, 21],
      particleCool: [233, 213, 255],
    },
    emerald: {
      id: 'emerald',
      name: 'Horizon Emerald',
      topBg: '#031714',
      midBg: '#063730',
      botBg: '#020908',
      auraPrimary: [16, 185, 129],
      auraSecondary: [52, 211, 153],
      particleGold: [253, 224, 71],
      particleCool: [167, 243, 208],
    },
    gold: {
      id: 'gold',
      name: 'Astro Gold',
      topBg: '#191003',
      midBg: '#3d2607',
      botBg: '#090601',
      auraPrimary: [245, 158, 11],
      auraSecondary: [251, 191, 36],
      particleGold: [254, 240, 138],
      particleCool: [253, 230, 138],
    },
    onyx: {
      id: 'onyx',
      name: 'Midnight Black',
      topBg: '#06080f',
      midBg: '#111827',
      botBg: '#020408',
      auraPrimary: [148, 163, 184],
      auraSecondary: [226, 232, 240],
      particleGold: [251, 191, 36],
      particleCool: [241, 245, 249],
    },
    light: {
      id: 'light',
      name: 'PS5 White',
      topBg: '#e2e8f0',
      midBg: '#f1f5f9',
      botBg: '#cbd5e1',
      auraPrimary: [37, 99, 235],
      auraSecondary: [56, 189, 248],
      particleGold: [217, 119, 6],
      particleCool: [59, 130, 246],
    },
  };

  let savedColor = 'blue';
  try {
    const fromStorage = localStorage.getItem('ps3_wave_color');
    if (fromStorage && THEMES[fromStorage]) savedColor = fromStorage;
  } catch {}

  let activeColorKey = savedColor;

  const getEffectivePalette = () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) return THEMES.light;
    return THEMES[activeColorKey] || THEMES.blue;
  };

  const updateColorIndicatorUI = () => {
    const pal = THEMES[activeColorKey] || THEMES.blue;
    const labelEl = document.getElementById('ps3ColorNameLabel');
    if (labelEl) labelEl.textContent = `Подсветка: ${pal.name}`;
    document.documentElement.setAttribute('data-wave-color', activeColorKey);
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let time = 0;
  let impulse = 0;
  let targetImpulse = 0;

  // PS5 Floating Golden & Cool Bokeh Particles
  const PARTICLE_COUNT = 46;
  const particles = [];

  const initParticles = () => {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isGold = i % 3 !== 0; // 2/3 warm PS5 golden bokeh, 1/3 cool blue bokeh
      particles.push({
        x: Math.random(),
        y: Math.random(),
        r: isGold ? 1.2 + Math.random() * 3.4 : 1.0 + Math.random() * 2.6,
        vx: (Math.random() - 0.35) * 0.00018,
        vy: -(0.00012 + Math.random() * 0.00028),
        alpha: 0.16 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        isGold,
      });
    }
  };
  initParticles();

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    width = Math.max(window.innerWidth, 320);
    height = Math.max(window.innerHeight, 320);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  window.addEventListener('resize', resize, { passive: true });
  resize();
  updateColorIndicatorUI();

  window.ps3WaveImpulse = () => {
    targetImpulse = Math.min(targetImpulse + 0.55, 1.3);
  };

  window.ps3Wave = {
    cycleColor() {
      const idx = THEME_ORDER.indexOf(activeColorKey);
      activeColorKey = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
      try {
        localStorage.setItem('ps3_wave_color', activeColorKey);
      } catch {}
      updateColorIndicatorUI();
      window.ps3WaveImpulse();
      return THEMES[activeColorKey];
    },
    setColor(key) {
      if (!THEMES[key]) return;
      activeColorKey = key;
      try {
        localStorage.setItem('ps3_wave_color', activeColorKey);
      } catch {}
      updateColorIndicatorUI();
      window.ps3WaveImpulse();
    },
    getColor() {
      return THEMES[activeColorKey];
    },
  };

  const drawFrame = () => {
    const pal = getEffectivePalette();
    const hasPic1 = document.documentElement.classList.contains('has-pic1');

    ctx.clearRect(0, 0, width, height);

    // 1. Base PS5 Deep HDR Gradient (translucent when game artwork is active)
    const bgGrad = ctx.createLinearGradient(0, 0, width * 0.35, height);
    if (hasPic1) {
      bgGrad.addColorStop(0, 'rgba(3, 8, 22, 0.42)');
      bgGrad.addColorStop(0.55, 'rgba(5, 14, 34, 0.58)');
      bgGrad.addColorStop(1, 'rgba(2, 5, 14, 0.86)');
    } else {
      bgGrad.addColorStop(0, pal.topBg);
      bgGrad.addColorStop(0.5, pal.midBg);
      bgGrad.addColorStop(1, pal.botBg);
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. PS5 Upper-Right Volumetric HDR Aura & Light Beams
    const [pr, pg, pb] = pal.auraPrimary;
    const [sr, sg, sb] = pal.auraSecondary;
    const [gr, gg, gb] = pal.particleGold;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const auraX = width * (0.76 + Math.sin(time * 0.5) * 0.04);
    const auraY = height * (0.18 + Math.cos(time * 0.4) * 0.03);
    const auraRadius = Math.max(width, height) * 0.72;

    const mainAura = ctx.createRadialGradient(auraX, auraY, 10, auraX, auraY, auraRadius);
    const auraBoost = hasPic1 ? 0.24 : 0.38;
    mainAura.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${auraBoost + impulse * 0.1})`);
    mainAura.addColorStop(0.42, `rgba(${sr}, ${sg}, ${sb}, ${auraBoost * 0.45})`);
    mainAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = mainAura;
    ctx.fillRect(0, 0, width, height);

    // Warm Golden PS5 Horizon Flare (top-left / center-top)
    const goldX = width * (0.34 + Math.cos(time * 0.35) * 0.05);
    const goldY = height * 0.12;
    const goldAura = ctx.createRadialGradient(goldX, goldY, 5, goldX, goldY, width * 0.45);
    goldAura.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, ${hasPic1 ? 0.10 : 0.16})`);
    goldAura.addColorStop(0.5, `rgba(${pr}, ${pg}, ${pb}, 0.06)`);
    goldAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = goldAura;
    ctx.fillRect(0, 0, width, height);

    // Soft PS5 Flowing Light Wave Horizon (subtle silk crest along the upper third)
    for (let b = 0; b < 3; b++) {
      const baseY = height * (0.24 + b * 0.06);
      ctx.beginPath();
      const step = 24;
      for (let x = 0; x <= width + step; x += step) {
        const nx = x / width;
        const y =
          baseY +
          Math.sin(nx * 3.6 + time * (0.8 + b * 0.15) + b) * (22 + impulse * 12) +
          Math.cos(nx * 2.1 - time * 0.5 + b * 1.7) * 14;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle =
        b === 0
          ? `rgba(${gr}, ${gg}, ${gb}, ${hasPic1 ? 0.16 : 0.24})`
          : `rgba(${sr}, ${sg}, ${sb}, ${hasPic1 ? 0.14 : 0.22})`;
      ctx.lineWidth = b === 0 ? 2.2 : 1.4;
      ctx.stroke();
    }

    // 3. PS5 Floating Golden & Ice-Blue Bokeh Particles
    const [cr, cg, cb] = pal.particleCool;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx * (1 + impulse * 1.5);
      p.y += p.vy * (1 + impulse * 1.8);
      if (p.y < -0.05) {
        p.y = 1.05;
        p.x = Math.random();
      }
      if (p.x < -0.05) p.x = 1.05;
      if (p.x > 1.05) p.x = -0.05;

      const px = p.x * width;
      const py = p.y * height;
      const twinkle = 0.65 + 0.35 * Math.sin(time * 2.2 + p.phase);
      const a = p.alpha * twinkle * (hasPic1 ? 0.78 : 1);

      const [r, g, bCol] = p.isGold ? [gr, gg, gb] : [cr, cg, cb];
      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.r * 3.2);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${bCol}, ${a})`);
      grad.addColorStop(0.45, `rgba(${r}, ${g}, ${bCol}, ${a * 0.35})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${bCol}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, p.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  let rafId = 0;
  const animate = () => {
    impulse += (targetImpulse - impulse) * 0.08;
    targetImpulse *= 0.92;
    time += 0.011 + impulse * 0.016;
    drawFrame();
    rafId = requestAnimationFrame(animate);
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) {
    drawFrame();
  } else {
    rafId = requestAnimationFrame(animate);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else if (!reducedMotion.matches) {
      rafId = requestAnimationFrame(animate);
    }
  });
})();
