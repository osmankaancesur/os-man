import { startAnomalyScene, chapters } from "./anomaly-scene.js";
import { rickStage } from "./rickroll.js";

let active = null;

function portal(kind, label) {
  active?.close();
  const returnTo = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = `signal-dialog signal-${kind}`;
  dialog.setAttribute("aria-label", label);
  const closeButton = document.createElement("button");
  closeButton.className = "signal-close";
  closeButton.textContent = "✕";
  closeButton.setAttribute("aria-label", "Return to desktop");
  dialog.append(closeButton);
  const cleanups = [];
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    cleanups.forEach((cleanup) => cleanup());
    dialog.close();
    dialog.remove();
    if (active?.dialog === dialog) active = null;
    if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
  };
  closeButton.onclick = close;
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  // Keep global desktop shortcuts from firing through the modal.
  dialog.addEventListener("keydown", (event) => event.stopPropagation());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && kind === "question") close();
  });
  document.body.append(dialog);
  dialog.showModal();
  closeButton.focus();
  active = { dialog, close };
  return { dialog, close, cleanups };
}

// All sounds are synthesized here, with a bounded master gain and no downloads.
function makeSound(scary = false) {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return { close() {}, mute() {} };
  let context;
  try {
    context = new Audio();
    context.resume().catch(() => {});
    const master = context.createGain();
    master.gain.value = scary ? 0.13 : 0.055;
    master.connect(context.destination);
    const now = context.currentTime;
    if (scary) {
      const buffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * 0.65),
        context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      const noise = context.createBufferSource(),
        filter = context.createBiquadFilter();
      noise.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = 1300;
      filter.Q.value = 0.7;
      noise.connect(filter);
      filter.connect(master);
      noise.start();
      const voice = context.createOscillator(),
        envelope = context.createGain();
      voice.type = "sawtooth";
      voice.frequency.setValueAtTime(170, now);
      voice.frequency.exponentialRampToValueAtTime(43, now + 0.6);
      envelope.gain.setValueAtTime(0.6, now);
      envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      voice.connect(envelope);
      envelope.connect(master);
      voice.start();
      voice.stop(now + 0.7);
    } else {
      for (const [i, frequency] of [55, 82.41, 110, 164.81, 220].entries()) {
        const oscillator = context.createOscillator(),
          volume = context.createGain();
        const lfo = context.createOscillator(),
          depth = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        volume.gain.value = 0.18;
        lfo.frequency.value = 0.08 + i * 0.019;
        depth.gain.value = 0.12;
        lfo.connect(depth);
        depth.connect(volume.gain);
        oscillator.connect(volume);
        volume.connect(master);
        oscillator.start();
        lfo.start();
      }
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(0.055, now + 2);
    }
    let muted = false;
    const sync = () => {
      if (context.state === "closed") return;
      document.hidden
        ? context.suspend().catch(() => {})
        : context.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", sync);
    return {
      mute(value) {
        muted = value;
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setTargetAtTime(
          muted ? 0 : scary ? 0.13 : 0.055,
          context.currentTime,
          0.08,
        );
      },
      close() {
        document.removeEventListener("visibilitychange", sync);
        if (context.state !== "closed") context.close().catch(() => {});
      },
    };
  } catch {
    context?.close().catch(() => {});
    return { close() {}, mute() {} };
  }
}

export function showJumpscare() {
  const { dialog, close, cleanups } = portal("scare", "Something noticed you");
  const sound = makeSound(true);
  cleanups.push(() => sound.close());
  const face = document.createElement("div");
  face.className = "signal-face";
  // Original vector creature: no external images and no repeated strobe.
  face.innerHTML = `<svg viewBox="0 0 700 700" aria-hidden="true"><defs><radialGradient id="signal-skin"><stop stop-color="#e7ddd0"/><stop offset=".63" stop-color="#98828a"/><stop offset="1" stop-color="#110709"/></radialGradient></defs><path fill="url(#signal-skin)" d="M350 18C90-30 38 166 102 351L190 587 350 695 510 587 598 351C662 166 610-30 350 18Z"/><path fill="#080307" d="M119 216Q205 156 308 242L259 338 164 315ZM581 216Q495 156 392 242L441 338 536 315Z"/><ellipse fill="#ff303a" cx="225" cy="263" rx="15" ry="27"/><ellipse fill="#ff303a" cx="475" cy="263" rx="15" ry="27"/><path fill="#080307" d="M324 302L287 407 350 384 413 407 376 302ZM188 403Q350 477 512 403Q519 632 350 658Q181 632 188 403Z"/><path fill="#dfd4bf" d="M205 427L236 488 253 441 278 511 304 451 330 520 350 461 370 520 396 451 422 511 447 441 464 488 495 427ZM241 578L256 525 281 611 305 548 330 636 350 552 370 636 395 548 419 611 444 525 459 578Z"/><path stroke="#511921" stroke-width="5" fill="none" d="M176 81L240 168M137 148L199 194M524 81L460 168M563 148L501 194M350 30L340 120 362 152 350 206"/></svg>`;
  const caption = document.createElement("p");
  caption.className = "signal-scare-caption";
  caption.textContent = "IT WAS NEVER LOCKED FROM YOUR SIDE.";
  dialog.append(face, caption);
  const timer = setTimeout(close, 2200);
  cleanups.push(() => clearTimeout(timer));
}

export function showRickroll(sound) {
  const { dialog, cleanups } = portal("rickroll", "An unexpected transmission");
  if (sound) cleanups.push(() => sound.close());
  const panel = document.createElement("section");
  panel.className = "signal-video-panel";
  panel.innerHTML = `<p class="signal-kicker">AUTHENTICATION FAILED SUCCESSFULLY</p><h2>You know the rules.</h2>${rickStage}<div class="rick-controls"><button class="rick-pause" aria-pressed="false">Pause dancing</button><button class="rick-mute" aria-pressed="false">Mute sound</button><a href="https://www.youtube.com/watch?v=dQw4w9WgXc" target="_blank" rel="noopener noreferrer">The original ↗</a></div>`;
  dialog.append(panel);
  sound?.play();
  const mute = panel.querySelector(".rick-mute"),
    pause = panel.querySelector(".rick-pause");
  mute.onclick = () => {
    const muted = mute.getAttribute("aria-pressed") !== "true";
    mute.setAttribute("aria-pressed", String(muted));
    mute.textContent = muted ? "Unmute sound" : "Mute sound";
    sound?.mute(muted);
  };
  pause.onclick = () => {
    const paused = pause.getAttribute("aria-pressed") !== "true";
    pause.setAttribute("aria-pressed", String(paused));
    pause.textContent = paused ? "Resume dancing" : "Pause dancing";
    panel.querySelector(".rick-stage").classList.toggle("rick-paused", paused);
  };
}

export function openMystery() {
  const { dialog } = portal("question", "An unknown signal");
  const panel = document.createElement("section");
  panel.className = "signal-question-panel";
  panel.innerHTML = `<p class="signal-kicker">UNLISTED FREQUENCY / 00.000</p><div class="signal-sigil" aria-hidden="true">⟡</div><p class="signal-whisper">You weren’t supposed to find this.</p><h2>Want to see<br>something <em>cool?</em></h2><p class="signal-question-note">The signal is waiting for an answer.</p><div class="signal-choices"><button data-answer="yes">Yes. Show me.</button><button data-answer="no">No.</button></div>`;
  dialog.append(panel);
  panel.querySelector('[data-answer="yes"]').onclick = showAnomaly;
  panel.querySelector('[data-answer="no"]').onclick = showJumpscare;
}

export function showAnomaly() {
  const { dialog, cleanups } = portal(
    "experience",
    "The unknown signal — interactive visual experience",
  );
  const sound = makeSound();
  cleanups.push(() => sound.close());
  const stage = document.createElement("section");
  stage.className = "anomaly-stage";
  stage.innerHTML = `<div class="signal-crosshair signal-crosshair-a"></div><div class="signal-crosshair signal-crosshair-b"></div><header class="anomaly-hud"><span>OS_MAN / UNLISTED CHANNEL</span><span class="signal-live">● SIGNAL FOUND</span></header><div class="anomaly-caption"><p class="signal-kicker"></p><h2></h2><p class="anomaly-description"></p></div><div class="anomaly-coordinates" aria-hidden="true">X / ∞<br>Y / ∅<br>Z / YOU</div><footer class="anomaly-controls"><span>move to orbit · touch to disturb</span><div><button class="signal-next">Shift reality →</button><button class="signal-pause" aria-pressed="false">Pause</button><button class="signal-mute" aria-pressed="false">Mute sound</button></div></footer>`;
  dialog.append(stage);
  const scene = startAnomalyScene(stage, (chapter) => {
    const [number, title, description] = chapters[chapter];
    stage.querySelector(".signal-kicker").textContent = number;
    stage.querySelector("h2").textContent = title;
    stage.querySelector(".anomaly-description").textContent = description;
    stage.dataset.chapter = String(chapter);
  });
  cleanups.push(() => scene.dispose());
  const mute = stage.querySelector(".signal-mute"),
    pause = stage.querySelector(".signal-pause");
  mute.onclick = () => {
    const on = mute.getAttribute("aria-pressed") !== "true";
    mute.setAttribute("aria-pressed", String(on));
    mute.textContent = on ? "Unmute sound" : "Mute sound";
    sound.mute(on);
  };
  pause.onclick = () => {
    const on = pause.getAttribute("aria-pressed") !== "true";
    pause.setAttribute("aria-pressed", String(on));
    pause.textContent = on ? "Resume" : "Pause";
    scene.pause(on);
  };
  stage.querySelector(".signal-next").onclick = () => scene.next();
}
