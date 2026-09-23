/* ================================================================
   background-manager.js – Custom backgrounds & animated effects
   ================================================================ */

// ─── Persisted State ────────────────────────────────────────────

const LS_KEY_IMG = "bg_custom_image";
const LS_KEY_IMG_OP = "bg_image_opacity";
const LS_KEY_EFFECTS = "bg_effects";

function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function save(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

const defaultEffectState = {
  particles: { active: false, count: 50, speed: 50 },
  aurora: { active: false, speed: 50, intensity: 50 },
  starfield: { active: false, count: 50, speed: 50 },
  noise: { active: false, opacity: 50 },
  gradientPulse: { active: false, speed: 50 },
  matrixRain: { active: false, density: 50, speed: 50 },
  cyberGrid: { active: false, speed: 50, perspective: 50 },
};

let effectState = loadJSON(LS_KEY_EFFECTS, structuredClone(defaultEffectState));

// Migration from old boolean state / adding missing keys
for (const key of Object.keys(defaultEffectState)) {
  if (!effectState[key]) {
    effectState[key] = { ...defaultEffectState[key] };
  } else if (typeof effectState[key] === "boolean") {
    effectState[key] = { ...defaultEffectState[key], active: effectState[key] };
  } else {
    // Ensure missing sub-properties exist
    for (const subKey in defaultEffectState[key]) {
      if (effectState[key][subKey] === undefined) {
        effectState[key][subKey] = defaultEffectState[key][subKey];
      }
    }
  }
}

let imageOpacity = loadJSON(LS_KEY_IMG_OP, 0.3);

// ─── Canvas & Image Elements (set during init) ─────────────────

let bgCanvas = null;
let bgCtx = null;
let bgImageDiv = null;
let animId = null;
let activeEffects = [];

// ─── Effect Classes ─────────────────────────────────────────────

class ParticleField {
  constructor(w, h, state) {
    this.particles = [];
    this.initCount(w, h, state.count);
  }
  initCount(w, h, density) {
    const count = Math.max(10, Math.floor(((w * h) / 12000) * (density / 50)));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.random() - 0.5,
        vy: Math.random() - 0.5,
        r: 1.5 + Math.random() * 1.5,
      });
    }
  }
  update(w, h, state) {
    if (this.lastCount !== state.count) {
      this.initCount(w, h, state.count);
      this.lastCount = state.count;
    }
    const speedMult = state.speed / 50;
    for (const p of this.particles) {
      p.x += p.vx * speedMult * 0.4;
      p.y += p.vy * speedMult * 0.4;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
    }
  }
  draw(ctx, w, h, rgb, state) {
    const [r, g, b] = rgb;
    const maxDist = 120;
    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i];
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
      ctx.fill();
      for (let j = i + 1; j < this.particles.length; j++) {
        const bp = this.particles[j];
        const dx = a.x - bp.x,
          dy = a.y - bp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bp.x, bp.y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.15 * (1 - dist / maxDist)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  }
}

class Aurora {
  constructor() {
    this.time = 0;
  }
  update(w, h, state) {
    const speedMult = state.speed / 50;
    this.time += 0.003 * speedMult;
  }
  draw(ctx, w, h, rgb, state) {
    const [r, g, b] = rgb;
    const intensityMult = state.intensity / 50;
    for (let band = 0; band < 3; band++) {
      ctx.beginPath();
      const yBase = h * 0.25 + band * h * 0.15;
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= w; x += 4) {
        const y =
          yBase +
          Math.sin(x * 0.005 + this.time + band * 1.2) * 40 +
          Math.sin(x * 0.008 - this.time * 0.7 + band * 0.8) * 25 +
          Math.sin(x * 0.002 + this.time * 0.3) * 60;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, yBase - 80, 0, yBase + 120);
      const alpha = Math.max(0, (0.04 - band * 0.008) * intensityMult);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }
}

class Starfield {
  constructor(w, h, state) {
    this.stars = [];
    this.initStars(w, h, state.count);
  }
  initStars(w, h, density) {
    const count = Math.floor(density * 4);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * w * 2,
        y: (Math.random() - 0.5) * h * 2,
        z: Math.random() * w,
      });
    }
  }
  update(w, h, state) {
    if (this.lastCount !== state.count) {
      this.initStars(w, h, state.count);
      this.lastCount = state.count;
    }
    const speedMult = state.speed / 50;
    for (const s of this.stars) {
      s.z -= 1.5 * speedMult;
      if (s.z <= 0) {
        s.x = (Math.random() - 0.5) * w * 2;
        s.y = (Math.random() - 0.5) * w * 2;
        s.z = w;
      }
    }
  }
  draw(ctx, w, h, rgb) {
    const [r, g, b] = rgb;
    const cx = w / 2,
      cy = h / 2;
    for (const s of this.stars) {
      const sx = (s.x / s.z) * 200 + cx;
      const sy = (s.y / s.z) * 200 + cy;
      const size = Math.max(0.3, (1 - s.z / w) * 2.5);
      const alpha = Math.max(0.1, (1 - s.z / w) * 0.7);
      if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
    }
  }
}

class NoiseGrain {
  constructor() {
    this.frameSkip = 0;
    this.imageData = null;
  }
  update() {
    this.frameSkip++;
  }
  draw(ctx, w, h, rgb, state) {
    if (this.frameSkip % 3 !== 0) return; // throttle
    if (
      !this.imageData ||
      this.imageData.width !== w ||
      this.imageData.height !== h
    ) {
      this.imageData = ctx.createImageData(w, h);
    }
    const d = this.imageData.data;
    const opacity = Math.floor((state.opacity / 100) * 16);
    const step = 4;
    for (let i = 0; i < d.length; i += 4 * step) {
      const v = Math.random() * 255;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = opacity;
    }
    ctx.putImageData(this.imageData, 0, 0);
  }
}

class GradientPulse {
  constructor() {
    this.time = 0;
  }
  update(w, h, state) {
    const speedMult = state.speed / 50;
    this.time += 0.008 * speedMult;
  }
  draw(ctx, w, h, rgb) {
    const [r, g, b] = rgb;
    const cx = w / 2 + Math.sin(this.time * 0.6) * w * 0.2;
    const cy = h / 2 + Math.cos(this.time * 0.4) * h * 0.2;
    const radius = Math.max(w, h) * (0.3 + Math.sin(this.time) * 0.1);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.06)`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},0.02)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

class MatrixRain {
  constructor(w, h, state) {
    this.columns = [];
    this.fontSize = 16;
    this.chars =
      "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    this.initColumns(w, state.density);
  }
  initColumns(w, density) {
    // density determines how many columns skip drawing
    const cols = Math.floor(w / this.fontSize);
    this.columns = [];
    for (let i = 0; i < cols; i++) {
      this.columns.push({
        x: i * this.fontSize,
        y: Math.random() * -1000,
        speed: 1 + Math.random() * 3,
        active: Math.random() < density / 100,
      });
    }
  }
  update(w, h, state) {
    if (this.lastDensity !== state.density) {
      this.initColumns(w, state.density);
      this.lastDensity = state.density;
    }
    const speedMult = state.speed / 50;
    for (const col of this.columns) {
      if (!col.active) continue;
      col.y += col.speed * speedMult;
      if (col.y > h && Math.random() > 0.95) {
        col.y = 0;
      }
    }
  }
  draw(ctx, w, h, rgb) {
    const [r, g, b] = rgb;
    ctx.fillStyle = `rgba(0, 0, 0, 0.05)`; // fade effect
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${this.fontSize}px monospace`;
    ctx.textAlign = "center";

    for (const col of this.columns) {
      if (!col.active) continue;
      const char = this.chars[Math.floor(Math.random() * this.chars.length)];
      ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
      ctx.fillText(char, col.x, col.y);
    }
  }
}

class CyberGrid {
  constructor() {
    this.offsetY = 0;
  }
  update(w, h, state) {
    const speedMult = state.speed / 50;
    this.offsetY += 1.5 * speedMult;
    if (this.offsetY > 40) this.offsetY = 0;
  }
  draw(ctx, w, h, rgb, state) {
    const [r, g, b] = rgb;
    const perspectiveY = h * (1 - (state.perspective / 100) * 0.8);

    ctx.beginPath();
    // Draw vertical perspective lines
    for (let i = -w; i < w * 2; i += 60) {
      ctx.moveTo(w / 2, perspectiveY);
      ctx.lineTo(i, h);
    }
    // Draw horizontal moving lines
    for (let y = 0; y < h - perspectiveY; y += 40) {
      const actualY = perspectiveY + y + this.offsetY;
      const scale = (actualY - perspectiveY) / (h - perspectiveY);
      if (scale > 0) {
        ctx.moveTo(0, actualY);
        ctx.lineTo(w, actualY);
      }
    }

    ctx.strokeStyle = `rgba(${r},${g},${b},0.3)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dark fade at the horizon
    const grad = ctx.createLinearGradient(
      0,
      perspectiveY,
      0,
      perspectiveY + 200,
    );
    grad.addColorStop(0, "#000000");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, perspectiveY, w, 200);
  }
}

// ─── Effect Registry ────────────────────────────────────────────

const effectRegistry = {
  particles: {
    label: "Particle Field",
    desc: "Floating dots connected by proximity lines",
    icon: "⬡",
    Factory: ParticleField,
    params: [
      { key: "count", label: "Density", min: 10, max: 100 },
      { key: "speed", label: "Speed", min: 10, max: 200 },
    ],
  },
  aurora: {
    label: "Aurora Borealis",
    desc: "Slow flowing gradient wave bands",
    icon: "🌌",
    Factory: Aurora,
    params: [
      { key: "speed", label: "Speed", min: 10, max: 200 },
      { key: "intensity", label: "Intensity", min: 10, max: 100 },
    ],
  },
  starfield: {
    label: "Starfield",
    desc: "Zooming stars from center perspective",
    icon: "✦",
    Factory: Starfield,
    params: [
      { key: "count", label: "Density", min: 10, max: 100 },
      { key: "speed", label: "Speed", min: 10, max: 200 },
    ],
  },
  noise: {
    label: "Noise Grain",
    desc: "Subtle film grain texture overlay",
    icon: "▒",
    Factory: NoiseGrain,
    params: [{ key: "opacity", label: "Opacity", min: 10, max: 100 }],
  },
  gradientPulse: {
    label: "Gradient Pulse",
    desc: "Pulsing radial theme-colored gradients",
    icon: "◉",
    Factory: GradientPulse,
    params: [{ key: "speed", label: "Speed", min: 10, max: 200 }],
  },
  matrixRain: {
    label: "Matrix Rain",
    desc: "Falling digital characters",
    icon: "01",
    Factory: MatrixRain,
    params: [
      { key: "density", label: "Density", min: 10, max: 100 },
      { key: "speed", label: "Speed", min: 10, max: 200 },
    ],
  },
  cyberGrid: {
    label: "Synthwave Grid",
    desc: "Moving 3D perspective grid",
    icon: "▦",
    Factory: CyberGrid,
    params: [
      { key: "speed", label: "Speed", min: 10, max: 200 },
      { key: "perspective", label: "Horizon Height", min: 10, max: 100 },
    ],
  },
};

// ─── Animation Loop ─────────────────────────────────────────────

function getThemeRGB() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--theme-rgb")
    .trim();
  return raw.split(",").map((s) => parseInt(s.trim()) || 0);
}

function rebuildEffects() {
  const w = bgCanvas ? bgCanvas.width : window.innerWidth;
  const h = bgCanvas ? bgCanvas.height : window.innerHeight;
  activeEffects = [];
  for (const [key, state] of Object.entries(effectState)) {
    if (state.active && effectRegistry[key]) {
      const Cls = effectRegistry[key].Factory;
      activeEffects.push({ key, inst: new Cls(w, h, state) });
    }
  }
}

function animationLoop() {
  if (!bgCanvas || !bgCtx) return;

  const w = bgCanvas.width,
    h = bgCanvas.height;

  // Matrix rain handles its own fade
  if (!activeEffects.some((e) => e.key === "matrixRain")) {
    bgCtx.clearRect(0, 0, w, h);
  }

  if (activeEffects.length > 0) {
    const rgb = getThemeRGB();
    for (const { key, inst } of activeEffects) {
      inst.update(w, h, effectState[key]);
      inst.draw(bgCtx, w, h, rgb, effectState[key]);
    }
  }

  animId = requestAnimationFrame(animationLoop);
}

function startLoop() {
  if (animId) return;
  animId = requestAnimationFrame(animationLoop);
}

function stopLoop() {
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

function hasAnyEffect() {
  return Object.values(effectState).some((v) => v.active);
}

// ─── Image Management ───────────────────────────────────────────

function applyImage() {
  if (!bgImageDiv) return;
  const dataUrl = localStorage.getItem(LS_KEY_IMG);
  if (dataUrl) {
    bgImageDiv.style.backgroundImage = `url(${dataUrl})`;
    bgImageDiv.style.opacity = imageOpacity;
    bgImageDiv.classList.add("active");
  } else {
    bgImageDiv.style.backgroundImage = "";
    bgImageDiv.classList.remove("active");
  }
}

function setImage(dataUrl) {
  try {
    localStorage.setItem(LS_KEY_IMG, dataUrl);
  } catch {
    /* quota */
  }
  applyImage();
}

function removeImage() {
  localStorage.removeItem(LS_KEY_IMG);
  applyImage();
}

function setImageOpacity(val) {
  imageOpacity = val;
  save(LS_KEY_IMG_OP, val);
  if (bgImageDiv) bgImageDiv.style.opacity = val;
}

// ─── Toggle & Update Effect ─────────────────────────────────────

function toggleEffect(key, forceState) {
  const newVal =
    forceState !== undefined ? forceState : !effectState[key].active;
  effectState[key].active = newVal;
  save(LS_KEY_EFFECTS, effectState);
  rebuildEffects();
  if (hasAnyEffect()) {
    bgCanvas.classList.add("active");
    startLoop();
  } else {
    bgCanvas.classList.remove("active");
    stopLoop();
  }
}

function updateEffectParam(effectKey, paramKey, val) {
  effectState[effectKey][paramKey] = val;
  save(LS_KEY_EFFECTS, effectState);
}

// ─── Boot-time Initializer (called once on page load) ───────────

export function initBackgroundEffects() {
  bgCanvas = document.getElementById("bg-effects-canvas");
  bgImageDiv = document.getElementById("bg-custom-image");

  if (!bgCanvas || !bgImageDiv) return;
  bgCtx = bgCanvas.getContext("2d");

  function resize() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    rebuildEffects();
  }
  resize();
  window.addEventListener("resize", resize);

  // Restore image
  applyImage();

  // Restore effects
  if (hasAnyEffect()) {
    bgCanvas.classList.add("active");
    rebuildEffects();
    startLoop();
  }
}

// ─── Manager Window UI ──────────────────────────────────────────

export function createBackgroundManager(win) {
  const body = document.createElement("div");
  body.className = "bgmgr-body";

  // ── Image Upload Section ─────────────────────────────────
  const imgSection = document.createElement("div");
  imgSection.className = "bgmgr-section";

  const imgTitle = document.createElement("h3");
  imgTitle.className = "bgmgr-section-title";
  imgTitle.textContent = "background_image";
  imgSection.appendChild(imgTitle);

  const dropZone = document.createElement("div");
  dropZone.className = "bgmgr-drop-zone";
  const hasImg = !!localStorage.getItem(LS_KEY_IMG);
  dropZone.innerHTML = hasImg
    ? '<span class="bgmgr-drop-text">✓ Image loaded — click or drop to replace</span>'
    : '<span class="bgmgr-drop-icon">📁</span><span class="bgmgr-drop-text">Click or drag an image here</span>';

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () =>
    dropZone.classList.remove("dragover"),
  );
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) loadImageFile(file);
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) loadImageFile(fileInput.files[0]);
  });

  function loadImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target.result);
      dropZone.innerHTML =
        '<span class="bgmgr-drop-text">✓ Image loaded — click or drop to replace</span>';
      opacitySlider.disabled = false;
      removeBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  imgSection.appendChild(dropZone);
  imgSection.appendChild(fileInput);

  // Opacity slider
  const opacityRow = document.createElement("div");
  opacityRow.className = "bgmgr-slider-row";
  const opacityLabel = document.createElement("span");
  opacityLabel.className = "bgmgr-slider-label";
  opacityLabel.textContent = "Opacity";
  const opacitySlider = document.createElement("input");
  opacitySlider.type = "range";
  opacitySlider.min = "0";
  opacitySlider.max = "100";
  opacitySlider.value = String(Math.round(imageOpacity * 100));
  opacitySlider.className = "bgmgr-slider";
  opacitySlider.disabled = !hasImg;
  const opacityVal = document.createElement("span");
  opacityVal.className = "bgmgr-slider-value";
  opacityVal.textContent = opacitySlider.value + "%";

  opacitySlider.addEventListener("input", () => {
    const v = parseInt(opacitySlider.value) / 100;
    setImageOpacity(v);
    opacityVal.textContent = opacitySlider.value + "%";
  });

  opacityRow.appendChild(opacityLabel);
  opacityRow.appendChild(opacitySlider);
  opacityRow.appendChild(opacityVal);
  imgSection.appendChild(opacityRow);

  // Remove image button
  const removeBtn = document.createElement("button");
  removeBtn.className = "bgmgr-remove-btn";
  removeBtn.textContent = "Remove Image";
  removeBtn.disabled = !hasImg;
  removeBtn.addEventListener("click", () => {
    removeImage();
    dropZone.innerHTML =
      '<span class="bgmgr-drop-icon">📁</span><span class="bgmgr-drop-text">Click or drag an image here</span>';
    opacitySlider.disabled = true;
    removeBtn.disabled = true;
  });
  imgSection.appendChild(removeBtn);

  body.appendChild(imgSection);

  // ── Effects Section ──────────────────────────────────────
  const effectsSection = document.createElement("div");
  effectsSection.className = "bgmgr-section";

  const effectsTitle = document.createElement("h3");
  effectsTitle.className = "bgmgr-section-title";
  effectsTitle.textContent = "animated_effects";
  effectsSection.appendChild(effectsTitle);

  const effectsList = document.createElement("div");
  effectsList.className = "bgmgr-effects-list";

  for (const [key, info] of Object.entries(effectRegistry)) {
    const card = document.createElement("div");
    const isActive = effectState[key].active;
    card.className = `bgmgr-effect-card ${isActive ? "active" : ""}`;

    const header = document.createElement("div");
    header.className = "bgmgr-effect-header";

    const iconLabel = document.createElement("div");
    iconLabel.className = "bgmgr-effect-info";
    iconLabel.innerHTML = `<span class="bgmgr-effect-icon">${info.icon}</span><span class="bgmgr-effect-name">${info.label}</span>`;

    const toggle = document.createElement("button");
    toggle.className = `bgmgr-effect-toggle ${isActive ? "on" : ""}`;
    toggle.textContent = isActive ? "ON" : "OFF";

    header.appendChild(iconLabel);
    header.appendChild(toggle);

    const desc = document.createElement("div");
    desc.className = "bgmgr-effect-desc";
    desc.textContent = info.desc;

    card.appendChild(header);
    card.appendChild(desc);

    // Parameters area (sliders)
    const paramsDiv = document.createElement("div");
    paramsDiv.className = "bgmgr-effect-params";
    paramsDiv.style.display = isActive ? "flex" : "none";

    info.params.forEach((param) => {
      const row = document.createElement("div");
      row.className = "bgmgr-slider-row";

      const label = document.createElement("span");
      label.className = "bgmgr-slider-label";
      label.textContent = param.label;

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = param.min;
      slider.max = param.max;
      slider.value = effectState[key][param.key];
      slider.className = "bgmgr-slider";

      const valText = document.createElement("span");
      valText.className = "bgmgr-slider-value";
      valText.textContent = slider.value;

      slider.addEventListener("input", () => {
        valText.textContent = slider.value;
        updateEffectParam(key, param.key, parseInt(slider.value));
      });

      row.appendChild(label);
      row.appendChild(slider);
      row.appendChild(valText);
      paramsDiv.appendChild(row);
    });

    card.appendChild(paramsDiv);

    toggle.addEventListener("click", () => {
      toggleEffect(key);
      const isOn = effectState[key].active;
      toggle.classList.toggle("on", isOn);
      toggle.textContent = isOn ? "ON" : "OFF";
      card.classList.toggle("active", isOn);
      paramsDiv.style.display = isOn ? "flex" : "none";
    });

    effectsList.appendChild(card);
  }

  effectsSection.appendChild(effectsList);
  body.appendChild(effectsSection);

  // ── Reset button ─────────────────────────────────────────
  const resetBtn = document.createElement("button");
  resetBtn.className = "bgmgr-reset-btn";
  resetBtn.textContent = "Reset All";
  resetBtn.addEventListener("click", () => {
    removeImage();
    dropZone.innerHTML =
      '<span class="bgmgr-drop-icon">📁</span><span class="bgmgr-drop-text">Click or drag an image here</span>';
    opacitySlider.value = "30";
    opacitySlider.disabled = true;
    opacityVal.textContent = "30%";
    removeBtn.disabled = true;
    setImageOpacity(0.3);

    for (const key of Object.keys(effectState)) {
      effectState[key] = { ...defaultEffectState[key] };
    }
    save(LS_KEY_EFFECTS, effectState);
    rebuildEffects();
    stopLoop();
    if (bgCanvas) bgCanvas.classList.remove("active");

    // Refresh UI
    win.body.innerHTML = "";
    createBackgroundManager(win);
  });
  body.appendChild(resetBtn);

  win.body.appendChild(body);
}
