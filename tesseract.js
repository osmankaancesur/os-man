/* ================================================================
   tesseract.js – 4D hypercube rendering
   ================================================================ */

import { currentThemeRGB } from "./terminal.js";

// ─── Geometry ───────────────────────────────────────────────────

const vertices4D = [];
for (let i = 0; i < 16; i++) {
  vertices4D.push([
    (i & 1) === 0 ? -1 : 1,
    (i & 2) === 0 ? -1 : 1,
    (i & 4) === 0 ? -1 : 1,
    (i & 8) === 0 ? -1 : 1,
  ]);
}

const edges = [];
for (let i = 0; i < 16; i++) {
  for (let j = i + 1; j < 16; j++) {
    let diffs = 0;
    for (let k = 0; k < 4; k++)
      if (vertices4D[i][k] !== vertices4D[j][k]) diffs++;
    if (diffs === 1) edges.push([i, j]);
  }
}

function matMul(a, b) {
  const res = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) res[i] += a[i][j] * b[j];
  return res;
}

// ─── Renderer ───────────────────────────────────────────────────

export function startTesseract(canvas, win) {
  const ctx = canvas.getContext("2d");
  let size = 100;
  let running = true;
  let hasDrawn = false;
  let pauseTimer;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let angleX = 0,
    angleY = 0,
    angleW = 0;

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const newSize = Math.min(parent.clientWidth, parent.clientHeight);
    if (newSize > 0 && canvas.width !== newSize) {
      size = newSize;
      canvas.width = size;
      canvas.height = size;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
    }
  }

  const ro = new ResizeObserver(() => requestAnimationFrame(resize));
  ro.observe(canvas.parentElement);
  win.cleanup = () => {
    ro.disconnect();
    running = false;
  };

  function render() {
    if (!running) return;
    if (
      win.el.hidden ||
      document.hidden ||
      (hasDrawn && reducedMotion.matches)
    ) {
      pauseTimer = setTimeout(render, 250);
      return;
    }
    hasDrawn = true;
    ctx.clearRect(0, 0, size, size);
    angleX += 0.005;
    angleY += 0.007;
    angleW += 0.003;

    const cosX = Math.cos(angleX),
      sinX = Math.sin(angleX);
    const cosY = Math.cos(angleY),
      sinY = Math.sin(angleY);
    const cosW = Math.cos(angleW),
      sinW = Math.sin(angleW);

    const rotXY = [
      [cosX, -sinX, 0, 0],
      [sinX, cosX, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    const rotZW = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, cosW, -sinW],
      [0, 0, sinW, cosW],
    ];
    const rotXZ = [
      [cosY, 0, -sinY, 0],
      [0, 1, 0, 0],
      [sinY, 0, cosY, 0],
      [0, 0, 0, 1],
    ];

    const projected = [];
    for (let i = 0; i < vertices4D.length; i++) {
      let v = vertices4D[i];
      v = matMul(rotXY, v);
      v = matMul(rotZW, v);
      v = matMul(rotXZ, v);
      const pw = 1 / (2.5 - v[3]);
      const proj3D = [v[0] * pw, v[1] * pw, v[2] * pw];
      const z = 1 / (2.5 - proj3D[2]);
      projected.push([
        proj3D[0] * z * size * 0.4 + size / 2,
        proj3D[1] * z * size * 0.4 + size / 2,
      ]);
    }

    const isCrt = win.el.classList.contains("crt-active");
    let currentAlpha = 1,
      currentGlow = 15;
    if (isCrt) {
      const phase = (Date.now() % 240) / 120;
      const intensity = phase > 1 ? 2 - phase : phase;
      currentAlpha = 0.95 + 0.05 * intensity;
      currentGlow = 15 + 10 * intensity;
    }

    const rgb = currentThemeRGB;
    ctx.globalAlpha = currentAlpha;
    ctx.lineWidth = 2;
    ctx.shadowBlur = currentGlow;
    ctx.shadowColor = `rgb(${rgb})`;

    ctx.strokeStyle = `rgba(${rgb}, 0.8)`;
    for (const edge of edges) {
      ctx.beginPath();
      ctx.moveTo(projected[edge[0]][0], projected[edge[0]][1]);
      ctx.lineTo(projected[edge[1]][0], projected[edge[1]][1]);
      ctx.stroke();
    }

    ctx.fillStyle = `rgb(${rgb})`;
    ctx.shadowBlur = currentGlow + 5;
    for (const p of projected) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(render);
  }

  setTimeout(render, 50);
  return () => {
    ro.disconnect();
    running = false;
    clearTimeout(pauseTimer);
  };
}
