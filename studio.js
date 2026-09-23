import { createSocials } from "./socials.js";
import { openMystery } from "./easter-eggs.js";
import { createShapeLab } from "./shape-lab.js";
import { isCrtEnabled, setCrtEnabled } from "./theme.js";
import {
  windows,
  windowTypes,
  spawnWindow,
  focusWindow,
  destroyWindow,
  viewport,
  openShortcutSettings,
} from "./window-manager.js";
import { setTreeRoot, getTreeRoot, applyLayout, makeLeaf } from "./tiling.js";
import { createGuestbook, mountReactions } from "./community.js";
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let catalog;
const getPosts = () =>
  catalog ||
  (catalog = fetch("/posts.json")
    .then((r) => {
      if (!r.ok) throw Error("Journal unavailable");
      return r.json();
    })
    .catch((e) => {
      catalog = null;
      throw e;
    }));
windowTypes.welcome = {
  title: "hello.md",
  icon: "⌂",
  create(win) {
    win.body.innerHTML =
      '<section class="welcome-body"><div class="eyebrow"><span class="status-dot"></span> an open desktop for the web</div><h1>Welcome to OS_MAN.<br><em>Make this space your own.</em></h1><p>An interactive desktop for writing, experiments, and small tools.</p><p>Explore the journal, try the terminal, or customize the colors and layout.</p><div class="welcome-links"><a href="https://github.com/osmankaancesur/os-man">Source code ↗</a><a href="/journal/">Read the journal →</a></div><div class="welcome-project"><span class="project-mark">&gt;_</span><div><a href="/posts/about-this-demo/">About this demo</a><small>a sample entry you can replace</small></div><span class="arrow">↗</span></div></section>';
    const socials = document.createElement("button");
    socials.className = "welcome-socials";
    socials.textContent = "Find me elsewhere ↗";
    socials.onclick = () => openApp("socials");
    win.body.querySelector(".welcome-links").append(socials);
  },
};
windowTypes.socials = {
  title: "socials",
  icon: "↗",
  create: createSocials,
};
windowTypes.journal = {
  title: "~/journal",
  icon: "▤",
  create(win) {
    const body = document.createElement("section");
    body.className = "journal-body";
    body.innerHTML =
      '<div class="journal-heading"><div><h2>Thinking out loud.</h2><p>Experiments, rabbit holes, and ordinary life.</p></div><span class="count">journal</span></div><div class="journal-filters" aria-label="Filter posts"></div><div class="post-list"><p class="empty-state">Opening the journal…</p></div><div class="journal-end"><span>no particular niche.</span><a href="/journal/">All entries ↗</a></div>';
    win.body.append(body);
    getPosts()
      .then((posts) => {
        if (!body.isConnected) return;
        body.querySelector(".count").textContent = `${posts.length} entries`;
        const filters = ["all", ...new Set(posts.flatMap((p) => p.tags))];
        function render(tag) {
          body.querySelector(".post-list").innerHTML =
            posts
              .filter((p) => tag === "all" || p.tags.includes(tag))
              .map(
                (p) =>
                  `<a class="post-row" href="/posts/${p.slug}/" data-slug="${p.slug}"><div class="post-meta"><time datetime="${p.date}">${new Date(p.date + "T12:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</time><span class="post-tag">${escape(p.tags[0] || "notes")}</span>${p.sample ? '<span class="sample-label">sample</span>' : ""}</div><h3>${escape(p.title)}<span>↗</span></h3><p>${escape(p.description)}</p><div class="post-foot">${p.minutes} min read · ${p.lang.toUpperCase()}</div></a>`,
              )
              .join("") || '<p class="empty-state">Nothing here yet.</p>';
          body.querySelectorAll("[data-slug]").forEach((a) =>
            a.addEventListener("click", (e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              openArticle(a.dataset.slug);
            }),
          );
        }
        for (const tag of filters) {
          const b = document.createElement("button");
          b.textContent = tag;
          b.className = tag === "all" ? "active" : "";
          b.setAttribute("aria-pressed", String(tag === "all"));
          b.onclick = () => {
            for (const x of b.parentElement.children) {
              x.classList.remove("active");
              x.setAttribute("aria-pressed", "false");
            }
            b.classList.add("active");
            b.setAttribute("aria-pressed", "true");
            render(tag);
          };
          body.querySelector(".journal-filters").append(b);
        }
        render("all");
      })
      .catch(() => {
        body.querySelector(".post-list").innerHTML =
          '<p class="empty-state">The journal could not load. <a href="/journal/">Try the reading view →</a></p>';
      });
  },
};
windowTypes.shapelab = {
  title: "shape_lab",
  icon: "◈",
  create: createShapeLab,
};
windowTypes.about = { ...windowTypes.welcome, hidden: true };
windowTypes.guestbook = {
  title: "guestbook",
  icon: "✎",
  create: createGuestbook,
};
windowTypes.appearance = {
  title: "appearance",
  icon: "◐",
  create(win) {
    win.body.innerHTML =
      '<section class="settings-body"><h2>Make yourself at home.</h2><div class="setting-row"><span>CRT monitor<small>Curved glass, scanlines, and phosphor glow.</small></span><button class="crt-toggle" aria-pressed="false">Off</button></div><div class="setting-row"><span>Keyboard shortcuts<small>Make this workspace feel familiar.</small></span><button class="keys">Configure</button></div><div class="setting-row"><span>Background effects<small>Optional distractions for the desktop.</small></span><button class="effects">Explore</button></div><p class="settings-note">Appearance preferences stay on this device. Reduced motion follows your system settings.</p></section>';
    const b = win.body.querySelector(".crt-toggle");
    const sync = () => {
      const on = isCrtEnabled();
      b.textContent = on ? "On" : "Off";
      b.setAttribute("aria-pressed", String(on));
    };
    b.onclick = () => setCrtEnabled(!isCrtEnabled());
    window.addEventListener("crtchange", sync);
    win.cleanup = () => window.removeEventListener("crtchange", sync);
    sync();
    win.body.querySelector(".keys").onclick = openShortcutSettings;
    win.body.querySelector(".effects").onclick = () => openApp("background");
  },
};
export function openApp(type) {
  const existing = Object.values(windows).find((w) => w.type === type);
  if (existing) {
    focusWindow(existing.id);
    existing.el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } else {
    spawnWindow(type);
    const last = Object.values(windows).at(-1);
    last?.el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
async function openArticle(slug) {
  const existing = Object.values(windows).find((w) => w.slug === slug);
  if (existing) {
    focusWindow(existing.id);
    return;
  }
  try {
    const res = await fetch(`/posts/${slug}/data.json`);
    if (!res.ok) throw Error();
    const p = await res.json();
    windowTypes.article = {
      title: p.title,
      icon: "▤",
      hidden: true,
      create(win) {
        win.slug = slug;
        const body = document.createElement("div");
        body.className = "reading-body";
        body.innerHTML = p.article;
        const top = body.querySelector(".article-top");
        const link = document.createElement("a");
        link.href = `/posts/${slug}/`;
        link.textContent = "Reading view ↗";
        top.append(link);
        win.body.append(body);
        body.querySelectorAll("[data-reactions]").forEach(mountReactions);
      },
    };
    spawnWindow("article");
    const w = Object.values(windows).at(-1);
    if (innerWidth > 700) w.el.querySelector(".wm-max-btn")?.click();
    w.el.scrollIntoView({ block: "start" });
  } catch {
    location.href = `/posts/${slug}/`;
  }
}
function home() {
  for (const w of Object.values(windows)) destroyWindow(w.id);
  spawnWindow("welcome");
  spawnWindow("guestbook");
  spawnWindow("journal");
  spawnWindow("terminal");
  const id = (type) => Object.values(windows).find((w) => w.type === type).id;
  setTreeRoot({
    type: "branch",
    split: "h",
    ratio: 0.43,
    children: [
      {
        type: "branch",
        split: "v",
        ratio: 0.61,
        children: [makeLeaf(id("welcome")), makeLeaf(id("guestbook"))],
      },
      {
        type: "branch",
        split: "v",
        ratio: 0.63,
        children: [makeLeaf(id("journal")), makeLeaf(id("terminal"))],
      },
    ],
  });
  applyLayout(viewport, windows);
  focusWindow(id("journal"));
}
function playground() {
  for (const w of Object.values(windows)) destroyWindow(w.id);
  spawnWindow("terminal");
  spawnWindow("tesseract");
  spawnWindow("shapelab");
  const id = (type) => Object.values(windows).find((w) => w.type === type).id;
  setTreeRoot({
    type: "branch",
    split: "h",
    ratio: 0.38,
    children: [
      {
        type: "branch",
        split: "v",
        ratio: 0.48,
        children: [makeLeaf(id("terminal")), makeLeaf(id("tesseract"))],
      },
      makeLeaf(id("shapelab")),
    ],
  });
  applyLayout(viewport, windows);
  focusWindow(id("shapelab"));
}
const workspaces = {};
let activeWorkspace = "home";
function switchWorkspace(name) {
  if (name === activeWorkspace) return;
  workspaces[activeWorkspace] = {
    tree: getTreeRoot(),
    windows: { ...windows },
  };
  for (const w of Object.values(windows)) {
    w.el.hidden = true;
    w.el.inert = false;
    w.el.classList.remove("wm-focused");
    delete windows[w.id];
  }
  setTreeRoot(null);
  activeWorkspace = name;
  const saved = workspaces[name];
  if (saved) {
    Object.assign(windows, saved.windows);
    setTreeRoot(saved.tree);
    for (const w of Object.values(windows)) {
      w.el.hidden = false;
      w.el.inert = false;
    }
    applyLayout(viewport, windows);
    const last = Object.values(windows).at(-1);
    if (last) focusWindow(last.id);
  } else {
    name === "home" ? home() : playground();
  }
}
export function bootWorkspace() {
  home();
  document.querySelector("#mystery-button").onclick = openMystery;
  document
    .querySelectorAll("[data-app]")
    .forEach((b) => (b.onclick = () => openApp(b.dataset.app)));
  document.querySelectorAll("[data-workspace]").forEach(
    (b) =>
      (b.onclick = () => {
        document.querySelectorAll("[data-workspace]").forEach((x) => {
          x.classList.toggle("active", x === b);
          x.setAttribute("aria-pressed", String(x === b));
        });
        switchWorkspace(b.dataset.workspace);
      }),
  );
  document.querySelector("#appearance-button").onclick = () =>
    openApp("appearance");
  const clock = document.querySelector("#system-clock");
  function tick() {
    clock.textContent = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    clock.dateTime = new Date().toISOString();
  }
  tick();
  setInterval(tick, 15000);
}
