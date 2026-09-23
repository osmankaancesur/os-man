import { getSocialLinks } from "./socials.config.js";

export function createSocials(win) {
  const body = document.createElement("section");
  body.className = "socials-body";
  body.innerHTML =
    '<div class="eyebrow">~/links · outgoing connections</div><h2>Find me elsewhere.</h2><p class="socials-intro">Project links and resources.</p><nav class="socials-list" aria-label="Project links"></nav><p class="socials-note">Profiles open in a new tab. Email opens your mail app.</p>';
  const links = getSocialLinks();
  for (const social of links) {
    const link = document.createElement("a");
    link.className = "social-link";
    link.href = social.url;
    const email = social.url.startsWith("mailto:");
    if (!email) {
      link.target = "_blank";
      link.rel = "noopener noreferrer me";
    }
    link.setAttribute(
      "aria-label",
      `${social.label}: ${social.handle} (${email ? "opens your mail app" : "opens in a new tab"})`,
    );
    const icon = document.createElement("span");
    icon.className = "social-icon";
    icon.textContent = social.icon;
    icon.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.className = "social-label";
    const label = document.createElement("strong"),
      handle = document.createElement("span");
    label.textContent = social.label;
    handle.textContent = social.handle;
    text.append(label, handle);
    const arrow = document.createElement("span");
    arrow.className = "social-arrow";
    arrow.textContent = "↗";
    arrow.setAttribute("aria-hidden", "true");
    link.append(icon, text, arrow);
    body.querySelector("nav").append(link);
  }
  if (!links.length)
    body.querySelector(".socials-note").textContent =
      "Quiet here for now. More connections soon.";
  win.body.append(body);
}
