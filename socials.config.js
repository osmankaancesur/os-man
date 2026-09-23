// Edit this list to update the Socials app and terminal contact.txt together.
// Add/reorder entries freely. An empty URL hides an entry until it is ready.
// Use https:// profile links or mailto: email links. No API keys are needed.
const socials = [
  { label: "Source", handle: "os-man", url: "https://github.com/osmankaancesur/os-man", icon: "⌘" },
];

export function getSocialLinks(entries = socials) {
  return entries
    .filter((entry) => entry.url?.trim())
    .map((entry) => {
      const label = entry.label?.trim();
      if (!label) throw Error("Every social link needs a label.");
      const url = new URL(entry.url.trim());
      if (
        !["https:", "mailto:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw Error(
          `Use an HTTPS profile URL or mailto: address for ${label}.`,
        );
      if (url.protocol === "mailto:" && !url.pathname.includes("@"))
        throw Error(`Use a complete email address for ${label}.`);
      return {
        label,
        handle: entry.handle?.trim() || url.href,
        url: url.href,
        icon: entry.icon || "↗",
      };
    });
}
