(function () {
  "use strict";

  const canvas = document.getElementById("world");
  const ctx = canvas && canvas.getContext("2d", { alpha: false, desynchronized: true });
  const root = document.documentElement;
  const chapters = Array.from(document.querySelectorAll(".chapter"));
  const navDots = Array.from(document.querySelectorAll(".chapter-dot"));
  const progressLine = document.getElementById("progressLine");
  const worldName = document.getElementById("worldName");
  const soundToggle = document.getElementById("soundToggle");
  const motionToggle = document.getElementById("motionToggle");
  const signal = document.getElementById("signal");
  const signalNote = document.getElementById("signalNote");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const labels = ["THE FIRST LIGHT", "THE UNIVERSE", "IN THE MAKING", "BETWEEN LINES", "THE RETURN"];
  let width = 1;
  let height = 1;
  let dpr = 1;
  let progress = 0;
  let activeChapter = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let reducedMotion = reducedMotionQuery.matches;
  let raf = 0;
  let lastFrame = 0;
  let audioContext = null;
  let masterGain = null;
  let tones = [];
  let audioActive = false;

  const clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const smooth = function (a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const mod = function (n, m) { return ((n % m) + m) % m; };

  let seed = 7102026;
  const rnd = function () {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const starCount = window.matchMedia("(max-width: 600px)").matches ? 360 : 620;
  const stars = [];
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: rnd(), y: rnd(), z: 0.12 + rnd() * 0.88,
      radius: 0.25 + Math.pow(rnd(), 3) * 1.4,
      phase: rnd() * Math.PI * 2,
      hue: rnd() > 0.77 ? 205 + rnd() * 25 : 0,
      drift: (rnd() - 0.5) * 0.13
    });
  }
  const galaxy = [];
  for (let i = 0; i < 1120; i++) {
    const arm = Math.floor(rnd() * 4);
    const radius = Math.pow(rnd(), 0.72);
    galaxy.push({
      arm: arm,
      radius: radius,
      angle: arm * Math.PI / 2 + radius * 3.5 + (rnd() - 0.5) * (0.28 + radius * 0.28),
      width: 0.2 + rnd() * 1.2,
      opacity: 0.14 + rnd() * 0.48,
      color: rnd()
    });
  }
  const nodes = [];
  for (let i = 0; i < 54; i++) {
    nodes.push({ x: 0.08 + rnd() * 0.84, y: 0.12 + rnd() * 0.77, phase: rnd() * 6.28, size: 0.7 + rnd() * 1.3 });
  }
  const glyphs = [];
  const words = ["again", "elsewhere", "remember", "before", "the end", "begin", "in between", "what if", "home"];
  for (let i = 0; i < 20; i++) {
    glyphs.push({
      x: 0.08 + rnd() * 0.84, y: 0.16 + rnd() * 0.70,
      word: words[Math.floor(rnd() * words.length)],
      size: 9 + rnd() * 13, rotation: (rnd() - 0.5) * 0.45,
      phase: rnd() * 6.28, opacity: 0.16 + rnd() * 0.32
    });
  }

  function resize() {
    if (!canvas || !ctx) return;
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.25 : 1.6);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateProgress();
    draw(performance.now() * 0.001);
  }

  function readProgress() {
    if (chapters.length < 2) return 0;
    const viewportMiddle = window.scrollY + window.innerHeight * 0.5;
    const centers = chapters.map(function (chapter) {
      return chapter.offsetTop + chapter.offsetHeight * 0.5;
    });
    if (viewportMiddle <= centers[0]) return 0;
    const last = centers.length - 1;
    if (viewportMiddle >= centers[last]) return 1;
    for (let i = 0; i < last; i++) {
      if (viewportMiddle >= centers[i] && viewportMiddle <= centers[i + 1]) {
        const span = Math.max(1, centers[i + 1] - centers[i]);
        return (i + (viewportMiddle - centers[i]) / span) / last;
      }
    }
    return 0;
  }

  function updateProgress() {
    progress = readProgress();
    activeChapter = clamp(Math.round(progress * (chapters.length - 1)), 0, chapters.length - 1);
    if (progressLine) progressLine.style.width = (progress * 100).toFixed(2) + "%";
    if (worldName) worldName.textContent = labels[activeChapter] || labels[0];
    navDots.forEach(function (dot, index) {
      if (index === activeChapter) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
    chapters.forEach(function (chapter) {
      const rect = chapter.getBoundingClientRect();
      const visible = rect.top < window.innerHeight * 0.82 && rect.bottom > window.innerHeight * 0.18;
      chapter.classList.toggle("is-visible", visible);
    });
    updateAudio(progress);
  }

  function moveTo(index) {
    const destination = chapters[clamp(Number(index) || 0, 0, chapters.length - 1)];
    if (!destination) return;
    destination.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  navDots.forEach(function (dot) {
    dot.addEventListener("click", function () { moveTo(dot.getAttribute("data-to")); });
  });
  document.querySelectorAll("[data-next]").forEach(function (button) {
    button.addEventListener("click", function () { moveTo(button.getAttribute("data-next")); });
  });
  const restart = document.getElementById("restart");
  if (restart) restart.addEventListener("click", function () { moveTo(0); });

  function setMotion(value) {
    reducedMotion = Boolean(value);
    root.classList.toggle("still", reducedMotion);
    if (motionToggle) {
      motionToggle.setAttribute("aria-pressed", String(reducedMotion));
      motionToggle.textContent = reducedMotion ? "Motion: low" : "Motion: on";
    }
    draw(performance.now() * 0.001);
  }
  setMotion(reducedMotion);
  if (motionToggle) {
    motionToggle.addEventListener("click", function () { setMotion(!reducedMotion); });
  }
  reducedMotionQuery.addEventListener && reducedMotionQuery.addEventListener("change", function (event) {
    setMotion(event.matches);
  });

  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", function (event) {
    pointerTargetX = (event.clientX / Math.max(1, width) - 0.5) * 2;
    pointerTargetY = (event.clientY / Math.max(1, height) - 0.5) * 2;
  }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !raf) raf = requestAnimationFrame(loop);
  });

  function roundRectGlow(x, y, radius, colorA, colorB) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, colorA);
    g.addColorStop(1, colorB);
    return g;
  }

  function drawBackground(progressValue) {
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, "#080b15");
    base.addColorStop(0.53, "#070910");
    base.addColorStop(1, "#05070c");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
    const amber = smooth(0.5, 0.76, progressValue) * (1 - smooth(0.78, 0.98, progressValue));
    if (amber > 0.001) {
      ctx.fillStyle = "rgba(44,28,18," + (amber * 0.23).toFixed(3) + ")";
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawStar(x, y, size, alpha, warm) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = warm ? "#f0d4ac" : "#e0e8f6";
    ctx.shadowBlur = size * 7;
    ctx.shadowColor = warm ? "rgba(238,196,143,.8)" : "rgba(192,219,242,.8)";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (size > 1.5) {
      ctx.strokeStyle = warm ? "rgba(242,213,176,.48)" : "rgba(221,236,250,.48)";
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.moveTo(x - size * 3.8, y);
      ctx.lineTo(x + size * 3.8, y);
      ctx.moveTo(x, y - size * 3.8);
      ctx.lineTo(x, y + size * 3.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpace(weight, time, finalView) {
    if (weight < 0.003) return;
    const cx = width * (0.51 + pointerX * (reducedMotion ? 0.001 : 0.012));
    const cy = height * (finalView ? 0.47 : 0.48) + pointerY * (reducedMotion ? 0.5 : 7);
    ctx.save();
    ctx.globalAlpha = weight;
    const nebula = roundRectGlow(cx, cy, Math.max(width, height) * 0.62, "rgba(76,89,145,.18)", "rgba(14,18,35,0)");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);

    if (!finalView) {
      const radiusMax = Math.min(width, height) * 0.52;
      ctx.save();
      ctx.translate(cx, cy);
      const galaxyTime = reducedMotion ? 0 : time;
      ctx.rotate(reducedMotion ? -0.18 : galaxyTime * 0.009 - 0.18);
      ctx.globalCompositeOperation = "lighter";
      galaxy.forEach(function (particle) {
        const radius = particle.radius * radiusMax;
        const ang = particle.angle + particle.radius * 0.08 * Math.sin(galaxyTime * 0.13 + particle.arm);
        const x = Math.cos(ang) * radius;
        const y = Math.sin(ang) * radius * 0.39;
        const warm = particle.color > 0.86 && particle.radius < 0.34;
        ctx.globalAlpha = weight * particle.opacity * (1 - particle.radius * 0.34);
        ctx.fillStyle = warm ? "rgba(230,197,163,.78)" : particle.color > 0.5 ? "rgba(164,192,227,.82)" : "rgba(184,195,231,.7)";
        ctx.beginPath();
        ctx.arc(x, y, particle.width, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    ctx.globalCompositeOperation = "source-over";
    const twinkleTime = reducedMotion ? 0 : time;
    stars.forEach(function (star) {
      const parallax = (reducedMotion ? 0 : 10) / star.z;
      const drift = reducedMotion ? 0 : time * star.drift * 1.5;
      const x = mod(star.x * width + pointerX * parallax + drift, width);
      const y = mod(star.y * height + pointerY * parallax * 0.5 + time * (reducedMotion ? 0 : star.z * 0.55), height);
      const twinkle = 0.38 + 0.62 * (0.5 + 0.5 * Math.sin(twinkleTime * (0.32 + star.z * 0.5) + star.phase));
      ctx.globalAlpha = weight * (0.23 + twinkle * 0.6) * (0.35 + star.z * 0.65);
      ctx.fillStyle = star.hue ? "rgba(183,211,237,.9)" : "rgba(235,238,248,.9)";
      ctx.beginPath();
      ctx.arc(x, y, star.radius * (0.45 + star.z * 0.6), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = weight;
    const core = roundRectGlow(cx, cy, finalView ? 125 : Math.min(width, height) * 0.24, "rgba(218,226,251,.24)", "rgba(117,145,207,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, width, height);
    if (!finalView) {
      ctx.strokeStyle = "rgba(185,206,238,.12)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.min(width, height) * 0.35, Math.min(width, height) * 0.14, -0.22, 0.08, Math.PI * 1.9);
      ctx.stroke();
      drawStar(cx + width * 0.19, cy - height * 0.18, 1.6, weight * 0.76, false);
    } else {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 0.7) * 0.04;
      ctx.strokeStyle = "rgba(213,224,244,.25)";
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 64 * pulse, 21 * pulse, -0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, 98 * pulse, 32 * pulse, -0.35, 0, Math.PI * 2);
      ctx.stroke();
      drawStar(cx, cy, 2.8 * pulse, weight, false);
      drawStar(cx - 83, cy + 26, 1.05, weight * 0.65, false);
      drawStar(cx + 90, cy - 30, 1.0, weight * 0.7, true);
      ctx.strokeStyle = "rgba(198,211,237,.14)";
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy);
      ctx.lineTo(cx + 12, cy);
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx, cy + 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDigital(weight, time) {
    if (weight < 0.003) return;
    ctx.save();
    ctx.globalAlpha = weight;
    const veil = ctx.createLinearGradient(0, 0, width, height);
    veil.addColorStop(0, "rgba(5,16,22,.97)");
    veil.addColorStop(0.55, "rgba(6,20,24,.94)");
    veil.addColorStop(1, "rgba(7,13,22,.97)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, width, height);

    const vanishX = width * (0.5 + pointerX * 0.025);
    const vanishY = height * 0.43 + pointerY * 3;
    ctx.save();
    ctx.lineWidth = 0.7;
    for (let i = -12; i <= 12; i++) {
      const bottomX = width / 2 + i * width / 12;
      ctx.strokeStyle = i % 3 === 0 ? "rgba(137,209,196,.19)" : "rgba(137,209,196,.09)";
      ctx.beginPath();
      ctx.moveTo(vanishX, vanishY);
      ctx.lineTo(bottomX, height + 15);
      ctx.stroke();
    }
    for (let i = 0; i < 19; i++) {
      const n = (i + 1) / 19;
      const z = (n * n);
      const y = vanishY + (height - vanishY) * z;
      ctx.strokeStyle = "rgba(137,209,196," + (0.035 + z * 0.12).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    const lineTime = reducedMotion ? 0 : time;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const ax = a.x * width + Math.sin(lineTime * 0.17 + a.phase) * 11;
      const ay = a.y * height + Math.cos(lineTime * 0.12 + a.phase) * 8;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const bx = b.x * width + Math.sin(lineTime * 0.17 + b.phase) * 11;
        const by = b.y * height + Math.cos(lineTime * 0.12 + b.phase) * 8;
        const dx = ax - bx;
        const dy = ay - by;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < Math.min(width, height) * 0.19) {
          ctx.strokeStyle = "rgba(121,204,191," + ((1 - distance / (Math.min(width, height) * 0.19)) * 0.14).toFixed(3) + ")";
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }
      ctx.fillStyle = "rgba(179,230,220,.76)";
      ctx.beginPath();
      ctx.arc(ax, ay, a.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.font = "9px 'DM Mono', monospace";
    ctx.fillStyle = "rgba(146,204,197,.42)";
    if (width > 650) {
      ctx.fillText("01001001", width * 0.12, height * 0.29);
      ctx.fillText("IDEA → INTERFACE", width * 0.69, height * 0.72);
      ctx.fillText("01010100", width * 0.74, height * 0.24);
    }
    ctx.restore();
  }

  function drawLiterature(weight, time) {
    if (weight < 0.003) return;
    ctx.save();
    ctx.globalAlpha = weight;
    const paper = ctx.createLinearGradient(0, 0, width, height);
    paper.addColorStop(0, "rgba(39,27,21,.98)");
    paper.addColorStop(0.48, "rgba(34,24,20,.96)");
    paper.addColorStop(1, "rgba(16,17,21,.98)");
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    const glow = roundRectGlow(width * 0.34, height * 0.46, Math.max(width, height) * 0.75, "rgba(186,128,76,.18)", "rgba(186,128,76,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    const drift = reducedMotion ? 0 : time;
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 17; i++) {
      const y = height * (0.10 + i * 0.051);
      const shift = Math.sin(drift * 0.12 + i * 0.58) * 26;
      ctx.strokeStyle = i % 3 === 0 ? "rgba(218,179,136,.13)" : "rgba(218,179,136,.065)";
      ctx.beginPath();
      ctx.moveTo(-30, y + shift);
      ctx.bezierCurveTo(width * 0.22, y - 60 - shift, width * 0.52, y + 80 + shift, width + 30, y - 6 + shift);
      ctx.stroke();
    }
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      const float = reducedMotion ? 0 : Math.sin(drift * 0.16 + glyph.phase) * 9;
      ctx.save();
      ctx.translate(glyph.x * width, glyph.y * height + float);
      ctx.rotate(glyph.rotation);
      ctx.globalAlpha = weight * glyph.opacity;
      ctx.fillStyle = "#e4c5a2";
      ctx.font = "italic " + glyph.size + "px 'Instrument Serif', Georgia, serif";
      ctx.fillText(glyph.word, 0, 0);
      ctx.restore();
    }
    ctx.strokeStyle = "rgba(227,192,157,.15)";
    ctx.lineWidth = 0.75;
    const pageX = width * 0.65 + pointerX * 8;
    ctx.beginPath();
    ctx.moveTo(pageX, height * 0.13);
    ctx.bezierCurveTo(pageX - width * 0.16, height * 0.35, pageX + width * 0.16, height * 0.67, pageX - width * 0.02, height * 0.89);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pageX + 9, height * 0.14);
    ctx.bezierCurveTo(pageX - width * 0.12, height * 0.35, pageX + width * 0.2, height * 0.68, pageX + 4, height * 0.89);
    ctx.stroke();
    ctx.restore();
  }

  function draw(time) {
    if (!ctx) return;
    drawBackground(progress);
    const spaceWeight = 1 - smooth(0.19, 0.43, progress);
    const digitalWeight = smooth(0.20, 0.42, progress) * (1 - smooth(0.46, 0.66, progress));
    const literatureWeight = smooth(0.49, 0.68, progress) * (1 - smooth(0.74, 0.89, progress));
    const returnWeight = smooth(0.81, 0.97, progress);
    drawSpace(spaceWeight, time, false);
    drawDigital(digitalWeight, time);
    drawLiterature(literatureWeight, time);
    drawSpace(returnWeight, time, true);
  }

  function loop(timestamp) {
    raf = 0;
    if (document.hidden) return;
    if (timestamp - lastFrame >= (reducedMotion ? 90 : 30)) {
      lastFrame = timestamp;
      const t = timestamp * 0.001;
      pointerX = lerp(pointerX, reducedMotion ? 0 : pointerTargetX, 0.045);
      pointerY = lerp(pointerY, reducedMotion ? 0 : pointerTargetY, 0.045);
      draw(t);
    }
    raf = requestAnimationFrame(loop);
  }

  function startAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      if (soundToggle) soundToggle.textContent = "Sound unavailable";
      return;
    }
    if (audioContext && masterGain && tones.length) {
      if (audioContext.state === "suspended") audioContext.resume();
      masterGain.gain.cancelScheduledValues(audioContext.currentTime);
      masterGain.gain.setTargetAtTime(0.022, audioContext.currentTime, 0.9);
      audioActive = true;
      if (soundToggle) {
        soundToggle.textContent = "Sound: on";
        soundToggle.setAttribute("aria-pressed", "true");
      }
      updateAudio(progress);
      return;
    }
    try {
      audioContext = new AudioContextClass();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0;
      const filter = audioContext.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 260;
      filter.Q.value = 0.3;
      filter.connect(masterGain);
      masterGain.connect(audioContext.destination);
      [55, 82.41, 110.0].forEach(function (frequency, index) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.detune.value = index === 1 ? -4 : index === 2 ? 3 : 0;
        gain.gain.value = index === 0 ? 0.52 : 0.17;
        oscillator.connect(gain);
        gain.connect(filter);
        oscillator.start();
        tones.push(oscillator);
      });
      if (audioContext.state === "suspended") audioContext.resume();
      masterGain.gain.setTargetAtTime(0.022, audioContext.currentTime, 1.2);
      audioActive = true;
      if (soundToggle) {
        soundToggle.textContent = "Sound: on";
        soundToggle.setAttribute("aria-pressed", "true");
      }
    } catch (error) {
      audioActive = false;
      if (soundToggle) soundToggle.textContent = "Sound unavailable";
    }
  }

  function stopAudio() {
    if (!audioContext || !masterGain) return;
    masterGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.35);
    audioActive = false;
    if (soundToggle) {
      soundToggle.textContent = "Sound: off";
      soundToggle.setAttribute("aria-pressed", "false");
    }
  }

  function updateAudio(p) {
    if (!audioActive || !audioContext || !tones.length) return;
    const notes = [
      [55, 82.41, 110],
      [49, 73.42, 98],
      [65.41, 82.41, 130.81],
      [58.27, 87.31, 116.54]
    ];
    const scaled = clamp(p, 0, 0.999) * (notes.length - 1);
    const i = Math.floor(scaled);
    const part = scaled - i;
    const current = notes[i];
    const next = notes[i + 1];
    tones.forEach(function (tone, index) {
      const frequency = lerp(current[index], next[index], smooth(0, 1, part));
      tone.frequency.setTargetAtTime(frequency, audioContext.currentTime, 0.8);
    });
  }

  if (soundToggle) {
    soundToggle.addEventListener("click", function () {
      if (audioActive) stopAudio();
      else startAudio();
    });
  }
  if (signal && signalNote) {
    signal.addEventListener("click", function () {
      const isOpen = signal.getAttribute("aria-expanded") === "true";
      signal.setAttribute("aria-expanded", String(!isOpen));
      signalNote.classList.toggle("is-open", !isOpen);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        signal.setAttribute("aria-expanded", "false");
        signalNote.classList.remove("is-open");
      }
    });
  }

  resize();
  updateProgress();
  if (ctx) raf = requestAnimationFrame(loop);
  else canvas && canvas.setAttribute("hidden", "hidden");
})();