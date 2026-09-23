import { closeLauncher, closeShortcutSettings } from "./window-manager.js";
export function setupDialogs() {
  let active = null,
    returnTo = null;
  const overlays = [...document.querySelectorAll(".overlay")];
  const background = [
    ...document.querySelectorAll(
      "body > header,body > main,body > footer,body > nav",
    ),
  ];
  const close = (overlay) =>
    overlay.id === "launcher-overlay"
      ? closeLauncher()
      : closeShortcutSettings();
  for (const overlay of overlays) {
    overlay
      .querySelector("[data-close-dialog]")
      ?.addEventListener("click", () => close(overlay));
  }
  const observer = new MutationObserver(() => {
    const next = overlays.find((o) => !o.classList.contains("hidden")) || null;
    if (next === active) return;
    if (next) {
      if (!active) returnTo = document.activeElement;
      active = next;
      background.forEach((e) => (e.inert = true));
      next.querySelector("button")?.focus();
    } else {
      active = null;
      background.forEach((e) => (e.inert = false));
      if (returnTo?.isConnected) returnTo.focus();
    }
  });
  for (const overlay of overlays)
    observer.observe(overlay, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener(
    "keydown",
    (event) => {
      if (!active || event.key !== "Tab") return;
      const items = [
        ...active.querySelectorAll(
          'button,a[href],input,select,textarea,[tabindex="0"]',
        ),
      ].filter((el) => !el.disabled && el.getClientRects().length);
      if (!items.length) return;
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    true,
  );
}
