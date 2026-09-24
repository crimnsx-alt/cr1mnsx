(() => {
  'use strict';

  const canvas = document.createElement('canvas');
  canvas.id = 'ps3WaveCanvas';
  canvas.className = 'ps3-wave-canvas';
  
  const bgContainer = document.querySelector('.bg');
  if (bgContainer) {
    // Скрываем видео аквариума, если пользователь выбрал тему PS3
    const bgVideo = document.getElementById('bgVideo');
    if (bgVideo) bgVideo.style.display = 'none';
    bgContainer.prepend(canvas);
  } else {
    document.body.prepend(canvas);
  }

  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Частицы пыли / светящиеся искры PS3
  const PARTICLE_COUNT = 45;
  const particles = [];

  const createParticle = () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 1.8 + 0.6,
    speedY: Math.random() * 0.4 + 0.15,
    swaySpeed: Math.random() * 0.02 + 0.01,
    swayAmp: Math.random() * 20 + 8,
    swaySeed: Math.random() * Math.PI * 2,
    alpha: Math.random() * 0.6 + 0.2,
    pulseSpeed: Math.random() * 0.02 + 0.01,
  });

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    if (particles.length === 0) {
      for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(createParticle());
    }
  };

  resize();
  window.addEventListener('resize', resize);

  let time = 0;
  let impulse = 0;

  // Функция импульса при переключении разделов
  window.ps3WaveImpulse = () => {
    impulse = Math.min(impulse + 1.2, 2.5);
  };

  // Параметры волн PS3 (гармоники)
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

  const animate = () => {
    time += 1;
    impulse *= 0.96; // плавное затухание импульса

    ctx.clearRect(0, 0, width, height);

    // 1. Глубокий градиент ночного космоса PS3
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#061328');
    bgGrad.addColorStop(0.45, '#0b2654');
    bgGrad.addColorStop(0.75, '#071b3e');
    bgGrad.addColorStop(1, '#020713');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Отрисовка волн шелковых лент PS3 (Additive Blending)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    waves.forEach((w, idx) => {
      const cy = height * w.baseY;
      const boost = 1 + impulse * 0.45;

      ctx.beginPath();
      ctx.moveTo(0, height);

      // Строим верхний край волны
      const points = [];
      const step = 8;
      for (let x = 0; x <= width + step; x += step) {
        let yOffset = 0;
        w.harmonics.forEach((h) => {
          yOffset += Math.sin(x * h.freq + time * w.speed + h.phase) * (h.amp * boost);
        });
        const y = cy + yOffset;
        points.push({ x, y });
        if (x === 0) ctx.lineTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();

      // Заливка объема волны
      const waveGrad = ctx.createLinearGradient(0, cy - 80 * boost, 0, height);
      waveGrad.addColorStop(0, w.colorStop0);
      waveGrad.addColorStop(0.3, w.colorStop1);
      waveGrad.addColorStop(0.85, w.colorStop2);
      ctx.fillStyle = waveGrad;
      ctx.fill();

      // Отрисовка светящегося гребня (Crest Line)
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = w.strokeColor;
      ctx.shadowColor = '#80c0ff';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    ctx.restore();

    // 3. Плавающие частицы пыли PS3
    ctx.save();
    particles.forEach((p) => {
      p.y -= p.speedY;
      p.swaySeed += p.swaySpeed;
      const curX = p.x + Math.sin(p.swaySeed) * p.swayAmp;
      
      // перенос снизу вверх
      if (p.y < -10) {
        p.y = height + 10;
        p.x = Math.random() * width;
      }

      const pulse = 0.6 + Math.sin(time * p.pulseSpeed + p.swaySeed) * 0.4;
      ctx.beginPath();
      ctx.arc(curX, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * pulse})`;
      ctx.shadowColor = 'rgba(160, 220, 255, 0.8)';
      ctx.shadowBlur = 6;
      ctx.fill();
    });
    ctx.restore();

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
})();
