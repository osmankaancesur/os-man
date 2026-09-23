/* ================================================================
   config.js – Mobile detection, shortcut management
   ================================================================ */

const mobileQuery = matchMedia("(max-width: 700px)");
export let isMobile = mobileQuery.matches;
mobileQuery.addEventListener("change", (e) => {
  isMobile = e.matches;
});

// ─── Shortcuts (persisted in localStorage) ──────────────────────
const DEFAULT_SHORTCUTS = {
  closeWindow: { mod: "Alt", key: "q", label: "Close focused window" },
  launcher: { mod: "Alt", key: "n", label: "Open launcher" },
  settings: { mod: "Alt", key: "s", label: "Shortcut settings" },
  focusLeft: { mod: "Alt", key: "ArrowLeft", label: "Focus left" },
  focusRight: { mod: "Alt", key: "ArrowRight", label: "Focus right" },
  focusUp: { mod: "Alt", key: "ArrowUp", label: "Focus up" },
  focusDown: { mod: "Alt", key: "ArrowDown", label: "Focus down" },
  spawnTerminal: { mod: "Alt", key: "1", label: "Spawn terminal" },
  spawnAbout: { mod: "Alt", key: "2", label: "Spawn about" },
  spawnTesseract: { mod: "Alt", key: "3", label: "Spawn tesseract" },
  spawnClock: { mod: "Alt", key: "4", label: "Spawn clock" },
  spawnShortcuts: { mod: "Alt", key: "5", label: "Spawn shortcuts help" },
  spawnGuestbook: { mod: "Alt", key: "6", label: "Spawn guestbook" },
  spawnCalculator: { mod: "Alt", key: "7", label: "Spawn calculator" },
  spawnBackground: { mod: "Alt", key: "8", label: "Spawn background" },
  spawnMusic: { mod: "Alt", key: "9", label: "Spawn music player" },
};

function loadShortcuts() {
  try {
    const saved = JSON.parse(localStorage.getItem("wm_shortcuts"));
    if (saved) {
      for (const k of Object.keys(DEFAULT_SHORTCUTS)) {
        if (!saved[k]) saved[k] = { ...DEFAULT_SHORTCUTS[k] };
      }
      return saved;
    }
  } catch (_) {
    /* ignore */
  }
  return JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
}

export const shortcuts = loadShortcuts();

export function saveShortcuts() {
  localStorage.setItem("wm_shortcuts", JSON.stringify(shortcuts));
}

export function shortcutString(s) {
  return `${s.mod}+${s.key.length === 1 ? s.key.toUpperCase() : s.key}`;
}

export function matchesShortcut(e, s) {
  const modOk =
    (s.mod === "Alt" && e.altKey && !e.ctrlKey && !e.metaKey) ||
    (s.mod === "Ctrl" && e.ctrlKey && !e.altKey && !e.metaKey) ||
    (s.mod === "Meta" && e.metaKey && !e.altKey && !e.ctrlKey) ||
    (s.mod === "Shift" &&
      e.shiftKey &&
      !e.altKey &&
      !e.ctrlKey &&
      !e.metaKey) ||
    (s.mod === "Ctrl+Shift" && e.ctrlKey && e.shiftKey) ||
    (s.mod === "Alt+Shift" && e.altKey && e.shiftKey);
  return modOk && e.key.toLowerCase() === s.key.toLowerCase();
}
