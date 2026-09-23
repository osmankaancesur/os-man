// Same O_ geometry as favicon.svg, tinted from the shared theme.
export function faviconSvg(rgb) {
  const channels = String(rgb).split(",").map(Number);
  const color =
    channels.length === 3 && channels.every(Number.isFinite)
      ? "#" +
        channels
          .map((n) =>
            Math.round(Math.max(0, Math.min(255, n)))
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")
      : "#ff3333";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#201721"/><circle cx="26" cy="30" r="12" fill="none" stroke="${color}" stroke-width="7"/><path d="M40 44h14" stroke="${color}" stroke-width="6"/></svg>`;
}
export function updateFavicon(rgb) {
  const link = document.querySelector('link[rel="icon"]');
  if (link)
    link.href = "data:image/svg+xml," + encodeURIComponent(faviconSvg(rgb));
}
