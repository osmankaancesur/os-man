import { currentThemeRGB } from "./theme.js";

const TAU = Math.PI * 2;
const specimens = {
  knot: {
    name: "Torus knot",
    note: "A single thread. Two turns around, three through the hole.",
    rows: 144,
    cols: 8,
  },
  mobius: {
    name: "Möbius ribbon",
    note: "One surface. One edge. A half-twist that changes everything.",
    rows: 112,
    cols: 14,
  },
  sphere: {
    name: "Wave sphere",
    note: "A sphere interrupted by a standing wave. Order, slightly disturbed.",
    rows: 96,
    cols: 32,
  },
};

function knotAt(u) {
  const r = 0.82 + 0.31 * Math.cos(3 * u);
  return [r * Math.cos(2 * u), r * Math.sin(2 * u), 0.42 * Math.sin(3 * u)];
}
function mesh(kind) {
  const { rows, cols } = specimens[kind];
  const points = [],
    edges = [];
  for (let i = 0; i <= rows; i++) {
    const u = (i / rows) * TAU;
    for (let j = 0; j <= cols; j++) {
      const v = j / cols;
      let p;
      if (kind === "knot") {
        const center = knotAt(u),
          next = knotAt(u + 0.001);
        const t = next.map((n, k) => n - center[k]);
        const len = Math.hypot(...t);
        t.forEach((n, k) => (t[k] = n / len));
        const normal = [-t[1], t[0], 0];
        const nl = Math.hypot(...normal);
        normal.forEach((n, k) => (normal[k] = n / nl));
        const binormal = [
          -t[2] * normal[1],
          t[2] * normal[0],
          t[0] * normal[1] - t[1] * normal[0],
        ];
        p = center.map(
          (n, k) =>
            n +
            0.085 *
              (normal[k] * Math.cos(v * TAU) + binormal[k] * Math.sin(v * TAU)),
        );
      } else if (kind === "mobius") {
        const w = (v - 0.5) * 0.85,
          r = 0.85 + w * Math.cos(u / 2);
        p = [r * Math.cos(u), r * Math.sin(u), w * Math.sin(u / 2)];
      } else {
        const lat = v * Math.PI,
          r = 0.91 + 0.13 * Math.sin(6 * u) * Math.sin(5 * lat);
        p = [
          r * Math.sin(lat) * Math.cos(u),
          r * Math.sin(lat) * Math.sin(u),
          r * Math.cos(lat),
        ];
      }
      const n = points.length;
      points.push(p);
      if (j > 0) edges.push([n - 1, n]);
      if (i > 0) edges.push([n - cols - 1, n]);
    }
  }
  return { points, edges };
}

export function createShapeLab(win) {
  const root = document.createElement("section");
  root.className = "shape-lab";
  root.innerHTML = `<div class="shape-presets" aria-label="Choose a shape">${Object.entries(
    specimens,
  )
    .map(
      ([key, s]) =>
        `<button data-shape="${key}" aria-pressed="${key === "knot"}">${s.name}</button>`,
    )
    .join("")}</div>
    <div class="shape-stage"><span class="shape-coordinate" aria-hidden="true">OBJECT / 001<br>PROJECTION: PERSPECTIVE</span><canvas tabindex="0" aria-label="Interactive 3D shape. Drag or use arrow keys to rotate. Plus and minus zoom. Space pauses rotation."></canvas><span class="shape-axis" aria-hidden="true">x · y · z</span></div>
    <p class="shape-note" aria-live="polite"></p><div class="shape-controls"><button class="shape-pause" aria-pressed="false">Pause</button><button class="shape-out" aria-label="Zoom out">−</button><output class="shape-zoom" aria-label="Zoom">100%</output><button class="shape-in" aria-label="Zoom in">+</button><button class="shape-reset">Reset view</button></div><p class="shape-hint">drag to orbit · + / − to zoom · space to pause</p>`;
  win.body.append(root);
  const canvas = root.querySelector("canvas"),
    ctx = canvas.getContext("2d");
  if (!ctx) {
    root.textContent = "Shape Lab needs a browser with canvas support.";
    return;
  }
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let geometry = mesh("knot"),
    angleX = -0.55,
    angleY = 0.3,
    zoom = 1;
  let paused = motion.matches,
    dragging = null,
    width = 0,
    height = 0;
  let frame = 0,
    last = 0,
    disposed = false,
    dirty = true;
  const pause = root.querySelector(".shape-pause");
  const syncPause = () => {
    pause.textContent = paused ? "Rotate" : "Pause";
    pause.setAttribute("aria-pressed", String(paused));
  };
  function wake() {
    dirty = true;
    if (!frame && !disposed) frame = requestAnimationFrame(draw);
  }
  function draw(now) {
    frame = 0;
    if (disposed || document.hidden || win.el.hidden || !width || !height) {
      last = 0;
      return;
    }
    const moving = !paused && !dragging;
    if (moving && last && now - last < 32 && !dirty) {
      frame = requestAnimationFrame(draw);
      return;
    }
    if (moving) angleY += Math.min(last ? now - last : 0, 50) * 0.00024;
    last = now;
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2,
      cy = height / 2,
      scale = Math.min(width, height) * 0.31 * zoom;
    ctx.strokeStyle = `rgba(${currentThemeRGB},0.09)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = cx % 32; x < width; x += 32) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = cy % 32; y < height; y += 32) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    const sx = Math.sin(angleX),
      cxr = Math.cos(angleX),
      sy = Math.sin(angleY),
      cyr = Math.cos(angleY);
    const projected = geometry.points.map(([x, y, z]) => {
      const y1 = y * cxr - z * sx,
        z1 = y * sx + z * cxr;
      const x2 = x * cyr + z1 * sy,
        z2 = -x * sy + z1 * cyr;
      const perspective = 4 / (4 - z2);
      return [cx + x2 * perspective * scale, cy + y1 * perspective * scale, z2];
    });
    // Depth buckets keep the rear wireframe dim without thousands of style changes.
    for (let bucket = 0; bucket < 5; bucket++) {
      ctx.strokeStyle =
        bucket === 4
          ? `rgba(${currentThemeRGB},0.95)`
          : `rgba(${currentThemeRGB},${0.09 + bucket * 0.13})`;
      ctx.lineWidth = bucket === 4 ? 1.2 : 0.8;
      ctx.beginPath();
      for (const [a, b] of geometry.edges) {
        const p = projected[a],
          q = projected[b];
        const depth = Math.max(
          0,
          Math.min(4, Math.floor((((p[2] + q[2]) / 2 + 1.4) / 2.8) * 5)),
        );
        if (depth !== bucket) continue;
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
    }
    dirty = false;
    if (moving) frame = requestAnimationFrame(draw);
  }
  function resize() {
    const box = canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2);
    width = box.width;
    height = box.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wake();
  }
  function setZoom(value) {
    zoom = Math.max(0.55, Math.min(1.8, value));
    root.querySelector(".shape-zoom").textContent =
      `${Math.round(zoom * 100)}%`;
    wake();
  }
  const toggle = () => {
    paused = !paused;
    syncPause();
    wake();
  };
  root.querySelector(".shape-note").textContent = specimens.knot.note;
  root.querySelectorAll("[data-shape]").forEach(
    (button, index) =>
      (button.onclick = () => {
        geometry = mesh(button.dataset.shape);
        root
          .querySelectorAll("[data-shape]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        root.querySelector(".shape-coordinate").innerHTML =
          `OBJECT / 00${index + 1}<br>PROJECTION: PERSPECTIVE`;
        root.querySelector(".shape-note").textContent =
          specimens[button.dataset.shape].note;
        wake();
      }),
  );
  pause.onclick = toggle;
  root.querySelector(".shape-in").onclick = () => setZoom(zoom + 0.1);
  root.querySelector(".shape-out").onclick = () => setZoom(zoom - 0.1);
  root.querySelector(".shape-reset").onclick = () => {
    angleX = -0.55;
    angleY = 0.3;
    setZoom(1);
  };
  canvas.onpointerdown = (e) => {
    if (e.button !== 0) return;
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.focus({ preventScroll: true });
  };
  canvas.onpointermove = (e) => {
    if (!dragging || dragging.id !== e.pointerId) return;
    angleY += (e.clientX - dragging.x) * 0.009;
    angleX += (e.clientY - dragging.y) * 0.009;
    dragging.x = e.clientX;
    dragging.y = e.clientY;
    wake();
  };
  canvas.onlostpointercapture = () => {
    dragging = null;
    wake();
  };
  canvas.onpointerup = canvas.onpointercancel = (e) => {
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
  };
  canvas.onkeydown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "=",
        "-",
        " ",
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === " ") toggle();
    if (e.key === "+" || e.key === "=") setZoom(zoom + 0.1);
    if (e.key === "-") setZoom(zoom - 0.1);
    if (e.key === "ArrowLeft") angleY -= 0.1;
    if (e.key === "ArrowRight") angleY += 0.1;
    if (e.key === "ArrowUp") angleX -= 0.1;
    if (e.key === "ArrowDown") angleX += 0.1;
    wake();
  };
  const onMotion = () => {
    paused = motion.matches;
    syncPause();
    wake();
  };
  motion.addEventListener("change", onMotion);
  document.addEventListener("visibilitychange", wake);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const observer = new MutationObserver(wake);
  observer.observe(win.el, { attributes: true, attributeFilter: ["hidden"] });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style"],
  });
  win.cleanup = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    ro.disconnect();
    observer.disconnect();
    motion.removeEventListener("change", onMotion);
    document.removeEventListener("visibilitychange", wake);
  };
  syncPause();
}
