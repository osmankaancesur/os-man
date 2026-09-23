import { isCrtEnabled } from "./theme.js";
/* ================================================================
   window-manager.js – Window CRUD, focus, drag-swap, overlays
   ================================================================ */

import {
  isMobile,
  shortcuts,
  saveShortcuts,
  shortcutString,
  matchesShortcut,
} from "./config.js";
import {
  makeLeaf,
  insertLeaf,
  insertLeafNextTo,
  removeLeaf,
  applyLayout,
  GAP,
} from "./tiling.js";
import {
  createTerminalState,
  updateFavicon,
  currentThemeRGB,
} from "./terminal.js";
import { startTesseract } from "./tesseract.js";
import { createCalculator } from "./calculator.js";
import {
  createBackgroundManager,
  initBackgroundEffects,
} from "./background-manager.js";
import { musicPlayer } from "./music-player.js";

// ─── State ──────────────────────────────────────────────────────

let nextId = 1;
export const windows = {};
export let focusedId = null;
export const viewport = document.getElementById("wm-viewport");
const dragGhost = document.getElementById("drag-ghost");
const dropIndicator = document.getElementById("drop-indicator");

// ─── Window Type Registry ───────────────────────────────────────

export const windowTypes = {};

// --- Terminal ---
windowTypes.terminal = {
  title: "terminal",
  icon: "⌨",
  create(win) {
    const wrapper = document.createElement("div");
    wrapper.className = "terminal-body";
    const content = document.createElement("div");
    content.className = "terminal-content";
    const output = document.createElement("div");
    output.className = "terminal-output";
    const inputLine = document.createElement("div");
    inputLine.className = "terminal-input-line";
    const prompt = document.createElement("span");
    prompt.className = "prompt";
    prompt.textContent = "guest@os-man:~$";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "terminal-input";
    input.setAttribute("aria-label", "Terminal command");
    input.autocomplete = "off";
    input.spellcheck = false;

    inputLine.appendChild(prompt);
    inputLine.appendChild(input);
    content.appendChild(output);
    content.appendChild(inputLine);
    wrapper.appendChild(content);
    win.body.appendChild(wrapper);

    createTerminalState(output, input, content, prompt);

    // Follow the prompt while a tile is laid out or resized, unless the visitor
    // has deliberately scrolled back through earlier output.
    let followOutput = true;
    content.addEventListener("scroll", () => {
      followOutput =
        content.scrollHeight - content.scrollTop - content.clientHeight < 8;
    });
    const terminalSize = new ResizeObserver(() => {
      if (followOutput) content.scrollTop = content.scrollHeight;
    });
    terminalSize.observe(content);
    win.cleanup = () => terminalSize.disconnect();

    wrapper.addEventListener("click", () => {
      if (!isMobile) {
        // Determine if there is any selected text
        const selection = window.getSelection();
        if (!selection || !selection.toString()) {
          input.focus();
        }
      }
    });
  },
};

// --- About ---
windowTypes.about = {
  title: "about_",
  icon: "📋",
  create(win) {
    const body = document.createElement("div");
    body.className = "about-body";
    body.innerHTML = `
            <h1>about_</h1>
            <p class="placeholder-text">
                Welcome to the OS_MAN demo workspace!
                <br><br>
                This website is always in development, and I will be adding more fun
                stuff whenever I feel like it. So please stop by once or twice a week to see what I've done.
                Right now I suggest you check out the guestbook and leave a message if you feel like it.
                <br><br>
                NOTE: This website heavily uses terminal commands and keyboard shortcuts. If you don't know what you're doing, you can always type "help" to see the available commands.
                It is nothing scary, I promise :)
                <br><br>
                Fork the repository and customize this workspace for yourself.
            </p>
        `;
    win.body.appendChild(body);
  },
};

// --- Tesseract ---
windowTypes.tesseract = {
  title: "4d_tesseract",
  icon: "◇",
  create(win) {
    const body = document.createElement("div");
    body.className = "tesseract-body";
    const canvas = document.createElement("canvas");
    body.appendChild(canvas);
    const label = document.createElement("div");
    label.className = "panel-label";
    label.textContent = "4D_TESSERACT_VISUALIZER";
    body.appendChild(label);
    win.body.appendChild(body);
    const cleanup = startTesseract(canvas, win);
    win.cleanup = cleanup;
  },
};

// --- Clock ---
windowTypes.clock = {
  title: "clock_",
  icon: "⏰",
  create(win) {
    const body = document.createElement("div");
    body.className = "clock-body";
    const timeEl = document.createElement("div");
    timeEl.className = "clock-time";
    const dateEl = document.createElement("div");
    dateEl.className = "clock-date";
    body.appendChild(timeEl);
    body.appendChild(dateEl);
    win.body.appendChild(body);

    function tick() {
      const now = new Date();
      timeEl.textContent = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      dateEl.textContent = now.toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    tick();
    const interval = setInterval(tick, 1000);
    win.cleanup = () => clearInterval(interval);
  },
};

// --- Shortcuts Help ---
windowTypes["shortcuts-help"] = {
  title: "shortcuts_",
  icon: "⌘",
  create(win) {
    const body = document.createElement("div");
    body.className = "shortcuts-body";
    function render() {
      let html =
        "<h2>keybindings_</h2><table><tr><th>Action</th><th>Shortcut</th></tr>";
      for (const [, s] of Object.entries(shortcuts)) {
        html += `<tr><td>${s.label}</td><td><kbd>${shortcutString(s)}</kbd></td></tr>`;
      }
      html += "</table>";
      body.innerHTML = html;
    }
    render();
    win.body.appendChild(body);
    win._refreshShortcuts = render;
  },
};

// --- Calculator ---
windowTypes.calculator = {
  title: "calculator_",
  icon: "🧮",
  create(win) {
    createCalculator(win);
  },
};

// --- Background Manager ---
windowTypes.background = {
  title: "background_",
  icon: "🎨",
  create(win) {
    createBackgroundManager(win);
  },
};

// --- Music Player ---
windowTypes.music = {
  title: "music_player",
  icon: "🎵",
  create(win) {
    const body = document.createElement("div");
    body.className = "music-body";

    // ── Now Playing / EQ Section ─────────────────────────
    const nowPlaying = document.createElement("div");
    nowPlaying.className = "music-now-playing";

    const eqWrapper = document.createElement("div");
    eqWrapper.className = "music-eq-wrapper";
    const eqCanvas = document.createElement("canvas");
    eqCanvas.className = "music-eq-canvas";
    eqWrapper.appendChild(eqCanvas);
    nowPlaying.appendChild(eqWrapper);

    const trackInfo = document.createElement("div");
    trackInfo.className = "music-track-info";
    const trackTitle = document.createElement("div");
    trackTitle.className = "music-track-title";
    trackTitle.textContent = "No Track";
    const trackArtist = document.createElement("div");
    trackArtist.className = "music-track-artist";
    trackArtist.textContent = "—";
    trackInfo.appendChild(trackTitle);
    trackInfo.appendChild(trackArtist);
    nowPlaying.appendChild(trackInfo);

    body.appendChild(nowPlaying);

    // ── Seek Bar ─────────────────────────────────────────
    const seekRow = document.createElement("div");
    seekRow.className = "music-seek-row";
    const seekTime = document.createElement("span");
    seekTime.className = "music-seek-time";
    seekTime.textContent = "0:00";
    const seekBar = document.createElement("input");
    seekBar.type = "range";
    seekBar.min = "0";
    seekBar.max = "1000";
    seekBar.value = "0";
    seekBar.className = "music-seek-bar";
    const seekDur = document.createElement("span");
    seekDur.className = "music-seek-time";
    seekDur.textContent = "0:00";
    seekRow.appendChild(seekTime);
    seekRow.appendChild(seekBar);
    seekRow.appendChild(seekDur);
    body.appendChild(seekRow);

    // ── Controls ─────────────────────────────────────────
    const controls = document.createElement("div");
    controls.className = "music-controls";

    const shuffleBtn = document.createElement("button");
    shuffleBtn.className = "music-ctrl-btn music-shuffle";
    shuffleBtn.textContent = "🔀";
    shuffleBtn.title = "Shuffle";
    if (musicPlayer.isShuffled()) shuffleBtn.classList.add("active");

    const prevBtn = document.createElement("button");
    prevBtn.className = "music-ctrl-btn music-prev";
    prevBtn.textContent = "⏮";

    const playBtn = document.createElement("button");
    playBtn.className = "music-ctrl-btn music-play-btn";
    playBtn.textContent = "▶";

    const nextBtn = document.createElement("button");
    nextBtn.className = "music-ctrl-btn music-next";
    nextBtn.textContent = "⏭";

    const repeatBtn = document.createElement("button");
    repeatBtn.className = "music-ctrl-btn music-repeat";
    repeatBtn.title = "Repeat";
    function updateRepeatIcon() {
      const mode = musicPlayer.getRepeatMode();
      repeatBtn.textContent = mode === "one" ? "🔂" : "🔁";
      repeatBtn.classList.toggle("active", mode !== "off");
    }
    updateRepeatIcon();

    controls.appendChild(shuffleBtn);
    controls.appendChild(prevBtn);
    controls.appendChild(playBtn);
    controls.appendChild(nextBtn);
    controls.appendChild(repeatBtn);
    body.appendChild(controls);

    // ── Volume ───────────────────────────────────────────
    const volRow = document.createElement("div");
    volRow.className = "music-vol-row";
    const volIcon = document.createElement("span");
    volIcon.className = "music-vol-icon";
    volIcon.textContent = "🔊";
    const volSlider = document.createElement("input");
    volSlider.type = "range";
    volSlider.min = "0";
    volSlider.max = "100";
    volSlider.value = String(Math.round(musicPlayer.getVolume() * 100));
    volSlider.className = "music-vol-slider";
    volRow.appendChild(volIcon);
    volRow.appendChild(volSlider);
    body.appendChild(volRow);

    // ── Playlist ─────────────────────────────────────────
    const playlistEl = document.createElement("div");
    playlistEl.className = "music-playlist";

    const pl = musicPlayer.getPlaylist();
    if (!pl.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No tracks yet. Add audio you own in public/ and update music-player.js.";
      playlistEl.append(empty);
    }
    function renderPlaylist() {
      playlistEl.innerHTML = "";
      pl.forEach((track, idx) => {
        const item = document.createElement("button");
        item.className = `music-pl-item ${idx === musicPlayer.getCurrentIndex() ? "active" : ""}`;
        item.innerHTML = `
                    <span class="music-pl-num">${String(idx + 1).padStart(2, "0")}</span>
                    <div class="music-pl-info">
                        <span class="music-pl-title">${track.title}</span>
                        <span class="music-pl-artist">${track.artist}</span>
                    </div>
                    <span class="music-pl-dur">${Number.isFinite(track.duration) ? fmtTime(track.duration) : "—"}</span>
                `;
        item.addEventListener("click", () => musicPlayer.play(idx));
        playlistEl.appendChild(item);
      });
    }
    renderPlaylist();
    body.appendChild(playlistEl);

    win.body.appendChild(body);

    // ── Wiring ───────────────────────────────────────────
    function fmtTime(s) {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${String(sec).padStart(2, "0")}`;
    }

    function syncUI() {
      const trk = musicPlayer.getCurrentTrack();
      if (trk) {
        trackTitle.textContent = trk.title;
        trackArtist.textContent = trk.artist;
      }
      playBtn.textContent = musicPlayer.isPlaying() ? "⏸" : "▶";
    }
    syncUI();

    playBtn.addEventListener("click", () => {
      if (musicPlayer.isPlaying()) musicPlayer.pause();
      else musicPlayer.play();
    });
    nextBtn.addEventListener("click", () => musicPlayer.next());
    prevBtn.addEventListener("click", () => musicPlayer.prev());
    shuffleBtn.addEventListener("click", () => {
      musicPlayer.toggleShuffle();
      shuffleBtn.classList.toggle("active", musicPlayer.isShuffled());
    });
    repeatBtn.addEventListener("click", () => {
      musicPlayer.cycleRepeat();
      updateRepeatIcon();
    });
    volSlider.addEventListener("input", () => {
      const v = parseInt(volSlider.value) / 100;
      musicPlayer.setVolume(v);
      volIcon.textContent = v === 0 ? "🔇" : v < 0.5 ? "🔉" : "🔊";
    });

    let seeking = false;
    seekBar.addEventListener("mousedown", () => {
      seeking = true;
    });
    seekBar.addEventListener(
      "touchstart",
      () => {
        seeking = true;
      },
      { passive: true },
    );
    seekBar.addEventListener("input", () => {
      musicPlayer.seek(parseInt(seekBar.value) / 1000);
    });
    seekBar.addEventListener("mouseup", () => {
      seeking = false;
    });
    seekBar.addEventListener("touchend", () => {
      seeking = false;
    });

    musicPlayer.on("play", syncUI);
    musicPlayer.on("pause", syncUI);
    musicPlayer.on("stop", syncUI);
    const onTrackChange = () => {
      syncUI();
      renderPlaylist();
    };
    musicPlayer.on("trackchange", onTrackChange);
    const onTimeUpdate = ({ currentTime, duration }) => {
      if (!seeking) {
        seekBar.value = String(
          duration > 0 ? Math.round((currentTime / duration) * 1000) : 0,
        );
      }
      seekTime.textContent = fmtTime(currentTime);
      seekDur.textContent = fmtTime(duration);
    };
    musicPlayer.on("timeupdate", onTimeUpdate);
    seekBar.setAttribute("aria-label", "Track position");
    volSlider.setAttribute("aria-label", "Volume");
    for (const b of [playBtn, nextBtn, prevBtn, shuffleBtn, repeatBtn])
      b.setAttribute("aria-label", b.title || "Playback");
    if (!pl.length) for (const b of [playBtn, nextBtn, prevBtn, shuffleBtn, repeatBtn, seekBar]) b.disabled = true;

    // ── EQ Visualizer ────────────────────────────────────
    let eqRunning = true;
    const eqCtx = eqCanvas.getContext("2d");
    const BAR_COUNT = 32;

    function resizeEQ() {
      const rect = eqWrapper.getBoundingClientRect();
      eqCanvas.width = rect.width * (window.devicePixelRatio || 1);
      eqCanvas.height = rect.height * (window.devicePixelRatio || 1);
      eqCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }

    // Initial resize after layout settles
    requestAnimationFrame(() => requestAnimationFrame(resizeEQ));
    win.onResize = resizeEQ;

    function drawEQ() {
      if (!eqRunning) return;
      requestAnimationFrame(drawEQ);

      const w = eqCanvas.width / (window.devicePixelRatio || 1);
      const h = eqCanvas.height / (window.devicePixelRatio || 1);
      eqCtx.setTransform(
        window.devicePixelRatio || 1,
        0,
        0,
        window.devicePixelRatio || 1,
        0,
        0,
      );
      eqCtx.clearRect(0, 0, w, h);

      const data = musicPlayer.getAnalyserData();
      const barW = w / BAR_COUNT - 2;
      const gap = 2;
      const maxH = h * 0.85;
      const reflectH = h * 0.12;

      // Parse theme color
      const themeStr = getComputedStyle(document.documentElement)
        .getPropertyValue("--theme-rgb")
        .trim();
      const [cr, cg, cb] = themeStr
        .split(",")
        .map((s) => parseInt(s.trim()) || 0);

      for (let i = 0; i < BAR_COUNT; i++) {
        // Average 4 frequency bins per bar
        const binStart = Math.floor((i / BAR_COUNT) * data.length);
        const binEnd = Math.floor(((i + 1) / BAR_COUNT) * data.length);
        let sum = 0;
        for (let j = binStart; j < binEnd; j++) sum += data[j];
        const avg = sum / (binEnd - binStart);
        const barH = (avg / 255) * maxH;

        const x = i * (barW + gap) + gap;
        const y = h * 0.75 - barH;

        // Bar gradient
        const grad = eqCtx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(
          0,
          `rgba(${Math.min(cr + 80, 255)},${Math.min(cg + 80, 255)},${Math.min(cb + 80, 255)},0.95)`,
        );
        grad.addColorStop(0.6, `rgba(${cr},${cg},${cb},0.7)`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0.3)`);

        // Glow
        eqCtx.shadowColor = `rgba(${cr},${cg},${cb},0.5)`;
        eqCtx.shadowBlur = 8;

        // Draw bar with rounded top
        const radius = Math.min(barW / 2, 3);
        eqCtx.beginPath();
        eqCtx.moveTo(x, y + barH);
        eqCtx.lineTo(x, y + radius);
        eqCtx.quadraticCurveTo(x, y, x + radius, y);
        eqCtx.lineTo(x + barW - radius, y);
        eqCtx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
        eqCtx.lineTo(x + barW, y + barH);
        eqCtx.closePath();
        eqCtx.fillStyle = grad;
        eqCtx.fill();

        // Reset shadow for reflection
        eqCtx.shadowBlur = 0;

        // Reflection (mirrored, faded)
        const reflY = h * 0.75;
        const reflBarH = Math.min(barH * 0.35, reflectH);
        const reflGrad = eqCtx.createLinearGradient(
          x,
          reflY,
          x,
          reflY + reflBarH,
        );
        reflGrad.addColorStop(0, `rgba(${cr},${cg},${cb},0.15)`);
        reflGrad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        eqCtx.fillStyle = reflGrad;
        eqCtx.fillRect(x, reflY + 2, barW, reflBarH);
      }

      // Horizontal divider line
      eqCtx.strokeStyle = `rgba(${cr},${cg},${cb},0.15)`;
      eqCtx.lineWidth = 0.5;
      eqCtx.beginPath();
      eqCtx.moveTo(0, h * 0.75 + 1);
      eqCtx.lineTo(w, h * 0.75 + 1);
      eqCtx.stroke();
    }
    requestAnimationFrame(drawEQ);

    // Cleanup
    win.cleanup = () => {
      eqRunning = false;
      musicPlayer.off("play", syncUI);
      musicPlayer.off("pause", syncUI);
      musicPlayer.off("stop", syncUI);
      musicPlayer.off("trackchange", onTrackChange);
      musicPlayer.off("timeupdate", onTimeUpdate);
    };
  },
};

// --- End built-in windows ---

// ─── Window Creation / Destruction ──────────────────────────────

function addWindowOrbs(el) {
  // Add 2-3 random inner light orbs to each window
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const orb = document.createElement("div");
    orb.className = "window-orb";
    const size = 80 + Math.random() * 120;
    orb.style.width = size + "px";
    orb.style.height = size + "px";
    orb.style.top = Math.random() * 80 - 20 + "%";
    orb.style.left = Math.random() * 80 - 10 + "%";
    orb.style.opacity = 0.4 + Math.random() * 0.4;
    el.appendChild(orb);
  }
}

function createWindowEl(id, title) {
  const el = document.createElement("div");
  const isCrt = isCrtEnabled();
  el.className = `wm-window ${isCrt ? "crt-active" : ""} wm-spawning`;
  el.dataset.wmId = id;
  el.tabIndex = -1;
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", title);

  el.addEventListener("animationend", function handler(e) {
    if (e.animationName === "windowSpawn") {
      el.classList.remove("wm-spawning");
      el.removeEventListener("animationend", handler);
    }
  });

  const titlebar = document.createElement("div");
  titlebar.className = "wm-titlebar";
  const titleText = document.createElement("span");
  titleText.className = "wm-title-text";
  titleText.textContent = title;
  const closeBtn = document.createElement("button");
  closeBtn.className = "wm-close-btn";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", `Close ${title}`);
  closeBtn.title = `Close (${shortcutString(shortcuts.closeWindow)})`;
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    destroyWindow(id);
  });

  titlebar.appendChild(titleText);
  const maxBtn = document.createElement("button");
  maxBtn.className = "wm-max-btn";
  maxBtn.textContent = "□";
  maxBtn.setAttribute("aria-label", "Expand window");
  maxBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const full = el.classList.toggle("wm-fullscreen");
    maxBtn.setAttribute(
      "aria-label",
      full ? "Restore window" : "Expand window",
    );
    for (const w of Object.values(windows)) w.el.inert = full && w.id !== id;
    if (full) {
      el.style.left = "0px";
      el.style.top = "0px";
      el.style.width = "100%";
      el.style.height = "100%";
      el.focus({ preventScroll: true });
    } else applyLayout(viewport, windows);
  });
  titlebar.appendChild(maxBtn);
  titlebar.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "wm-body";

  el.appendChild(titlebar);
  el.appendChild(body);

  // Add inner light orbs
  addWindowOrbs(el);

  el.addEventListener("mousedown", () => focusWindow(id));
  el.addEventListener("focusin", () => focusWindow(id));
  el.addEventListener("touchstart", () => focusWindow(id), { passive: true });

  setupDragSwap(titlebar, id);

  viewport.appendChild(el);
  return { el, body };
}

export function focusWindow(id) {
  for (const w of Object.values(windows)) {
    if (w.id !== id && w.el.classList.contains("wm-fullscreen"))
      w.el.querySelector(".wm-max-btn").click();
  }
  if (focusedId === id) return;
  for (const w of Object.values(windows)) w.el.classList.remove("wm-focused");
  focusedId = id;
  const win = windows[id];
  if (win) {
    win.el.classList.add("wm-focused");
    if (!isMobile) {
      const inp = win.el.querySelector(".terminal-input");
      if (inp) inp.focus();
    }
  }
}

export function spawnWindow(typeName) {
  const factory = windowTypes[typeName];
  if (!factory) return;
  const id = nextId++;
  const { el, body } = createWindowEl(id, factory.title);
  el.dataset.windowType = typeName;
  const winObj = {
    id,
    type: typeName,
    el,
    body,
    cleanup: null,
    onResize: null,
    rect: null,
  };
  windows[id] = winObj;
  factory.create(winObj);
  insertLeaf(makeLeaf(id), focusedId);
  applyLayout(viewport, windows);
  focusWindow(id);
  closeLauncher();
}

export function destroyWindow(id) {
  const win = windows[id];
  if (!win) return;
  const el = win.el;
  el.classList.add("wm-closing");

  removeLeaf(id);
  if (focusedId === id) {
    focusedId = null;
    const ids = Object.keys(windows).filter((k) => Number(k) !== id);
    if (ids.length) focusWindow(Number(ids[ids.length - 1]));
  }
  delete windows[id];
  applyLayout(viewport, windows);

  if (win.cleanup) win.cleanup();
  el.remove();
  if (el.classList.contains("wm-fullscreen"))
    for (const w of Object.values(windows)) w.el.inert = false;
}

// ─── Focus Navigation ───────────────────────────────────────────

export function focusInDirection(direction) {
  if (!focusedId || !windows[focusedId]) return;
  const current = windows[focusedId].rect;
  if (!current) return;
  const cx = current.x + current.w / 2;
  const cy = current.y + current.h / 2;
  let bestId = null,
    bestDist = Infinity;

  for (const [id, win] of Object.entries(windows)) {
    const numId = Number(id);
    if (numId === focusedId || !win.rect) continue;
    const r = win.rect;
    const wx = r.x + r.w / 2,
      wy = r.y + r.h / 2;
    let valid = false;
    switch (direction) {
      case "left":
        valid = wx < cx - 10;
        break;
      case "right":
        valid = wx > cx + 10;
        break;
      case "up":
        valid = wy < cy - 10;
        break;
      case "down":
        valid = wy > cy + 10;
        break;
    }
    if (valid) {
      const dist = Math.hypot(wx - cx, wy - cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = numId;
      }
    }
  }
  if (bestId !== null) focusWindow(bestId);
}

// ─── Drag-to-Insert ─────────────────────────────────────────────

let activeDrag = null;
let lastDropZone = null;

function setupDragSwap(titlebar, windowId) {
  // Mouse (Alt+drag)
  titlebar.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || e.target.closest("button") || innerWidth <= 700)
      return;
    e.preventDefault();
    e.stopPropagation();
    startDrag(windowId, e.clientX, e.clientY);
    const onMove = (ev) => {
      ev.preventDefault();
      moveDrag(ev.clientX, ev.clientY);
    };
    const onUp = (ev) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      endDrag(ev.clientX, ev.clientY);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  // Touch (long-press)
  let touchTimer = null,
    touchId = null,
    longPressActive = false;
  titlebar.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchId = touch.identifier;
      const sx = touch.clientX,
        sy = touch.clientY;
      longPressActive = false;
      touchTimer = setTimeout(() => {
        touchTimer = null;
        longPressActive = true;
        startDrag(windowId, sx, sy);
      }, 500);
    },
    { passive: true },
  );

  titlebar.addEventListener(
    "touchmove",
    (e) => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
      if (!longPressActive) return;
      const t = Array.from(e.touches).find((t) => t.identifier === touchId);
      if (!t) return;
      e.preventDefault();
      moveDrag(t.clientX, t.clientY);
    },
    { passive: false },
  );

  titlebar.addEventListener("touchend", (e) => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
    if (!longPressActive) return;
    const t = Array.from(e.changedTouches).find(
      (t) => t.identifier === touchId,
    );
    if (t) endDrag(t.clientX, t.clientY);
    else cancelDrag();
    longPressActive = false;
  });

  titlebar.addEventListener("touchcancel", () => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
    if (longPressActive) cancelDrag();
    longPressActive = false;
  });
}

function startDrag(windowId, x, y) {
  const win = windows[windowId];
  if (!win) return;
  activeDrag = { windowId, startX: x, startY: y };
  lastDropZone = null;
  dragGhost.textContent = win.el.querySelector(".wm-title-text").textContent;
  dragGhost.classList.remove("hidden");
  dragGhost.style.width = "140px";
  dragGhost.style.height = "36px";
  dragGhost.style.left = x - 70 + "px";
  dragGhost.style.top = y - 18 + "px";
  win.el.classList.add("wm-dragging");
}

function moveDrag(x, y) {
  if (!activeDrag) return;
  dragGhost.style.left = x - 70 + "px";
  dragGhost.style.top = y - 18 + "px";

  const vpRect = viewport.getBoundingClientRect();
  const vx = x - vpRect.left,
    vy = y - vpRect.top;
  let targetId = null,
    targetRect = null;

  for (const [id, win] of Object.entries(windows)) {
    const numId = Number(id);
    if (numId === activeDrag.windowId || !win.rect) continue;
    const r = win.rect;
    if (vx >= r.x && vx <= r.x + r.w && vy >= r.y && vy <= r.y + r.h) {
      targetId = numId;
      targetRect = r;
      break;
    }
  }

  if (targetId !== null && targetRect) {
    const relX = (vx - targetRect.x) / targetRect.w;
    const relY = (vy - targetRect.y) / targetRect.h;
    const distLeft = relX,
      distRight = 1 - relX,
      distTop = relY,
      distBottom = 1 - relY;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    let side, indicatorRect;
    if (minDist === distLeft) {
      side = "left";
      indicatorRect = {
        x: targetRect.x,
        y: targetRect.y,
        w: targetRect.w * 0.5,
        h: targetRect.h,
      };
    } else if (minDist === distRight) {
      side = "right";
      indicatorRect = {
        x: targetRect.x + targetRect.w * 0.5,
        y: targetRect.y,
        w: targetRect.w * 0.5,
        h: targetRect.h,
      };
    } else if (minDist === distTop) {
      side = "top";
      indicatorRect = {
        x: targetRect.x,
        y: targetRect.y,
        w: targetRect.w,
        h: targetRect.h * 0.5,
      };
    } else {
      side = "bottom";
      indicatorRect = {
        x: targetRect.x,
        y: targetRect.y + targetRect.h * 0.5,
        w: targetRect.w,
        h: targetRect.h * 0.5,
      };
    }

    lastDropZone = { targetId, side };
    dropIndicator.classList.remove("hidden");
    dropIndicator.style.left = vpRect.left + indicatorRect.x + "px";
    dropIndicator.style.top = vpRect.top + indicatorRect.y + "px";
    dropIndicator.style.width = indicatorRect.w + "px";
    dropIndicator.style.height = indicatorRect.h + "px";
  } else {
    lastDropZone = null;
    dropIndicator.classList.add("hidden");
  }
}

function endDrag() {
  if (!activeDrag) return;
  const sourceId = activeDrag.windowId;

  if (lastDropZone && lastDropZone.targetId !== sourceId) {
    const { targetId, side } = lastDropZone;
    removeLeaf(sourceId);
    let splitDir, position;
    if (side === "left") {
      splitDir = "h";
      position = "before";
    } else if (side === "right") {
      splitDir = "h";
      position = "after";
    } else if (side === "top") {
      splitDir = "v";
      position = "before";
    } else {
      splitDir = "v";
      position = "after";
    }
    insertLeafNextTo(makeLeaf(sourceId), targetId, splitDir, position);
    applyLayout(viewport, windows);
  }
  cancelDrag();
}

function cancelDrag() {
  if (activeDrag) {
    const win = windows[activeDrag.windowId];
    if (win) win.el.classList.remove("wm-dragging");
  }
  activeDrag = null;
  lastDropZone = null;
  dragGhost.classList.add("hidden");
  dropIndicator.classList.add("hidden");
}

// ─── Launcher Overlay ───────────────────────────────────────────

const launcherOverlay = document.getElementById("launcher-overlay");
const launcherList = document.getElementById("launcher-list");

export function openLauncher() {
  launcherList.innerHTML = "";
  const shortcutMap = {
    terminal: "spawnTerminal",
    about: "spawnAbout",
    tesseract: "spawnTesseract",
    clock: "spawnClock",
    "shortcuts-help": "spawnShortcuts",
    guestbook: "spawnGuestbook",
    calculator: "spawnCalculator",
    background: "spawnBackground",
    music: "spawnMusic",
  };
  for (const [typeName, factory] of Object.entries(windowTypes)) {
    if (factory.hidden) continue;
    const item = document.createElement("button");
    item.className = "launcher-item";
    const scName = shortcutMap[typeName];
    const sc = scName ? shortcuts[scName] : null;
    item.innerHTML = `
            <span class="launcher-icon">${factory.icon}</span>
            <span class="launcher-label">${factory.title}</span>
            ${sc ? `<span class="launcher-shortcut">${shortcutString(sc)}</span>` : ""}
        `;
    item.addEventListener("click", () => {
      closeLauncher();
      spawnWindow(typeName);
    });
    launcherList.appendChild(item);
  }
  launcherOverlay.classList.remove("hidden");
}

export function closeLauncher() {
  launcherOverlay.classList.add("hidden");
}

launcherOverlay.addEventListener("click", (e) => {
  if (e.target === launcherOverlay) closeLauncher();
});

// ─── FAB Button ─────────────────────────────────────────────────

document.getElementById("fab-launcher").addEventListener("click", () => {
  launcherOverlay.classList.contains("hidden")
    ? openLauncher()
    : closeLauncher();
});

// ─── Shortcut Settings Overlay ──────────────────────────────────

const shortcutOverlay = document.getElementById("shortcut-overlay");
const shortcutListEl = document.getElementById("shortcut-list");
let listeningAction = null;

export function openShortcutSettings() {
  renderShortcutSettings();
  shortcutOverlay.classList.remove("hidden");
}

export function closeShortcutSettings() {
  listeningAction = null;
  shortcutOverlay.classList.add("hidden");
}

function renderShortcutSettings() {
  shortcutListEl.innerHTML = "";
  for (const [action, s] of Object.entries(shortcuts)) {
    const row = document.createElement("div");
    row.className = "shortcut-row";
    const label = document.createElement("span");
    label.className = "shortcut-action";
    label.textContent = s.label;
    const btn = document.createElement("button");
    btn.className = "shortcut-key-btn";
    if (listeningAction === action) {
      btn.classList.add("listening");
      btn.textContent = "press key...";
    } else {
      btn.textContent = shortcutString(s);
    }
    btn.addEventListener("click", () => {
      listeningAction = action;
      renderShortcutSettings();
    });
    row.appendChild(label);
    row.appendChild(btn);
    shortcutListEl.appendChild(row);
  }
}

shortcutOverlay.addEventListener("click", (e) => {
  if (e.target === shortcutOverlay) closeShortcutSettings();
});

// ─── Global Keyboard Handler ────────────────────────────────────

document.addEventListener("keydown", (e) => {
  // Shortcut rebinding mode
  if (listeningAction && !shortcutOverlay.classList.contains("hidden")) {
    if (e.key === "Escape") {
      listeningAction = null;
      renderShortcutSettings();
      return;
    }
    let mod = "";
    if (e.ctrlKey && e.shiftKey) mod = "Ctrl+Shift";
    else if (e.altKey && e.shiftKey) mod = "Alt+Shift";
    else if (e.altKey) mod = "Alt";
    else if (e.ctrlKey) mod = "Ctrl";
    else if (e.metaKey) mod = "Meta";
    else if (e.shiftKey) mod = "Shift";

    if (mod && !["Alt", "Control", "Shift", "Meta"].includes(e.key)) {
      e.preventDefault();
      shortcuts[listeningAction].mod = mod;
      shortcuts[listeningAction].key = e.key;
      saveShortcuts();
      listeningAction = null;
      renderShortcutSettings();
      for (const w of Object.values(windows)) {
        if (w._refreshShortcuts) w._refreshShortcuts();
      }
      document.querySelectorAll(".wm-close-btn").forEach((btn) => {
        btn.title = `Close (${shortcutString(shortcuts.closeWindow)})`;
      });
    }
    return;
  }

  // Escape closes overlays
  if (e.key === "Escape") {
    if (!launcherOverlay.classList.contains("hidden")) {
      closeLauncher();
      e.preventDefault();
      return;
    }
    if (!shortcutOverlay.classList.contains("hidden")) {
      closeShortcutSettings();
      e.preventDefault();
      return;
    }
  }

  if (
    !launcherOverlay.classList.contains("hidden") ||
    !shortcutOverlay.classList.contains("hidden")
  )
    return;
  // Shortcuts
  if (matchesShortcut(e, shortcuts.closeWindow)) {
    e.preventDefault();
    if (focusedId !== null) destroyWindow(focusedId);
    return;
  }
  if (matchesShortcut(e, shortcuts.launcher)) {
    e.preventDefault();
    launcherOverlay.classList.contains("hidden")
      ? openLauncher()
      : closeLauncher();
    return;
  }
  if (matchesShortcut(e, shortcuts.settings)) {
    e.preventDefault();
    shortcutOverlay.classList.contains("hidden")
      ? openShortcutSettings()
      : closeShortcutSettings();
    return;
  }
  if (matchesShortcut(e, shortcuts.focusLeft)) {
    e.preventDefault();
    focusInDirection("left");
    return;
  }
  if (matchesShortcut(e, shortcuts.focusRight)) {
    e.preventDefault();
    focusInDirection("right");
    return;
  }
  if (matchesShortcut(e, shortcuts.focusUp)) {
    e.preventDefault();
    focusInDirection("up");
    return;
  }
  if (matchesShortcut(e, shortcuts.focusDown)) {
    e.preventDefault();
    focusInDirection("down");
    return;
  }
  if (matchesShortcut(e, shortcuts.spawnTerminal)) {
    e.preventDefault();
    spawnWindow("terminal");
    return;
  }
  if (matchesShortcut(e, shortcuts.spawnAbout)) {
    e.preventDefault();
    spawnWindow("about");
    return;
  }
  if (matchesShortcut(e, shortcuts.spawnTesseract)) {
    e.preventDefault();
    spawnWindow("tesseract");
    return;
  }
  if (matchesShortcut(e, shortcuts.spawnClock)) {
    e.preventDefault();
    spawnWindow("clock");
    return;
  }
  if (matchesShortcut(e, shortcuts.spawnShortcuts)) {
    e.preventDefault();
    spawnWindow("shortcuts-help");
    return;
  }
  if (matchesShortcut(e, shortcuts.spawnGuestbook)) {
    e.preventDefault();
    spawnWindow("guestbook");
    return;
  }
  if (matchesShortcut(e, shortcuts.spawnCalculator)) {
    e.preventDefault();
    spawnWindow("calculator");
    return;
  }
  if (matchesShortcut(e, shortcuts.spawnBackground)) {
    e.preventDefault();
    spawnWindow("background");
    return;
  }
  if (matchesShortcut(e, shortcuts.spawnMusic)) {
    e.preventDefault();
    spawnWindow("music");
    return;
  }
});

// ─── Resize Handling ────────────────────────────────────────────

let resizeRaf = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => applyLayout(viewport, windows));
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    const vv = window.visualViewport;
    if (innerWidth <= 700) return;
    viewport.style.height = "";
    viewport.style.top = "";
    applyLayout(viewport, windows);
  });
}

// Prevent body scrolling on mobile (allow scrollable children)
document.addEventListener(
  "touchmove",
  (e) => {
    if (innerWidth <= 700) return;
    let el = e.target;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight
      )
        return;
      el = el.parentElement;
    }
    e.preventDefault();
  },
  { passive: false },
);

// ─── Initial favicon tint ───────────────────────────────────────
updateFavicon(currentThemeRGB);

// ─── Boot background effects ────────────────────────────────────
initBackgroundEffects();
