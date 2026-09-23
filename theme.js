import { updateFavicon } from "./favicon.js";
// Shared by the desktop and standalone reading pages.
const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
export let currentThemeRGB = read("theme_color") || "255, 51, 51";
let crtEnabled = read("crt_active") !== "false";
export const isCrtEnabled = () => crtEnabled;
export function setThemeRGB(rgb) {
  setRainbow(false);
  currentThemeRGB = rgb;
  document.documentElement.style.setProperty("--theme-rgb", rgb);
  save("theme_color", rgb);
  updateFavicon(rgb);
}
export function setCrtEnabled(on, persist = true) {
  crtEnabled = on;
  if (persist) save("crt_active", String(on));
  document.documentElement.dataset.crt = String(on);
  document
    .querySelectorAll(".wm-window")
    .forEach((el) => el.classList.toggle("crt-active", on));
  document.getElementById("global-scanlines")?.classList.toggle("active", on);
  window.dispatchEvent(new Event("crtchange"));
}
document.documentElement.style.setProperty("--theme-rgb", currentThemeRGB);
updateFavicon(currentThemeRGB);
setCrtEnabled(isCrtEnabled(), false);

// One shared clock drives CSS accents and the existing canvas apps together.
// Never persist individual animation frames to localStorage.
let rainbowTimer;
let rainbow = false;
let hue = 0;
const motion = matchMedia("(prefers-reduced-motion: reduce)");
function spectrumFrame() {
  if (!rainbow || document.hidden || motion.matches) return;
  hue = (hue + 2.4) % 360;
  const channels = [0, 8, 4].map((n) => {
    const k = (n + hue / 30) % 12;
    return Math.round(
      255 * (0.6 - 0.4 * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
    );
  });
  currentThemeRGB = channels.join(", ");
  document.documentElement.style.setProperty("--theme-rgb", currentThemeRGB);
  // The favicon is intentionally updated less often than page accents.
  if (Math.round(hue / 2.4) % 8 === 0) updateFavicon(currentThemeRGB);
}
function syncSpectrum() {
  clearInterval(rainbowTimer);
  if (rainbow && !document.hidden && !motion.matches) {
    spectrumFrame();
    rainbowTimer = setInterval(spectrumFrame, 120);
  }
}
export function setRainbow(on, persist = true) {
  rainbow = on;
  document.documentElement.dataset.rainbow = String(on);
  if (persist) save("theme_rainbow", String(on));
  if (!on) {
    currentThemeRGB = read("theme_color") || "255, 51, 51";
    document.documentElement.style.setProperty("--theme-rgb", currentThemeRGB);
    updateFavicon(currentThemeRGB);
  }
  syncSpectrum();
}
motion.addEventListener("change", syncSpectrum);
document.addEventListener("visibilitychange", syncSpectrum);
setRainbow(read("theme_rainbow") === "true", false);
