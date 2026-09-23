import fs from "node:fs/promises";
import { marked } from "marked";
import { build } from "esbuild";
import config from "../site.config.mjs";
import { getSocialLinks } from "../socials.config.js";
import { readPosts, escape as e } from "./content.mjs";
import { writeVercelOutput } from "./vercel-output.mjs";
export async function buildSite() {
  getSocialLinks(); // Reject broken/unsafe configured links before deployment.
  const posts = await readPosts(),
    out = "dist/client";
  await fs.rm("dist", { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });
  const files = [
    "index.html",
    "style.css",
    "workspace.css",
    "signal.css",
    "changelog.md",
    "favicon.svg",
  ];
  for (const f of files) await fs.copyFile(f, `${out}/${f}`);
  await fs.writeFile(
    `${out}/posts.json`,
    JSON.stringify(posts.map(({ html, ...p }) => p)),
  );
  await fs.cp("public", out, {
    recursive: true,
    filter: (source) => !source.endsWith(".gitkeep"),
  });
  const head = (title, description, url, lang = "en", type = "article") =>
    `<!doctype html><html lang="${lang}" class="reader-root"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)} — OS_MAN</title><meta name="description" content="${e(description)}"><link rel="canonical" href="${e(url)}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(url)}"><meta property="og:type" content="${type}"><meta name="theme-color" content="#111013"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/workspace.css"><link rel="alternate" type="application/rss+xml" href="/feed.xml" title="OS_MAN journal"><link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><script type="module" src="/reading.js"></script></head><body class="reader-page"><a class="skip-link" href="#article">Skip to content</a><header class="system-bar"><a class="wordmark" href="/"><span class="logo-symbol">o_</span>OS_MAN<span class="wordmark-version">/ personal space</span></a><a class="back-link" href="/">↖ Back to the desktop</a></header>`;
  const footer = `<footer>OS_MAN · <a href="/feed.xml">Follow via RSS</a> · <a href="/privacy/">Privacy &amp; Cookies</a></footer>`;
  const privacy = marked.parse(
    await fs.readFile("content/pages/privacy.md", "utf8"),
  );
  await fs.mkdir(`${out}/privacy`, { recursive: true });
  await fs.writeFile(
    `${out}/privacy/index.html`,
    `${head("Privacy & Cookies", "How this personal website uses data, cookies and browser storage.", config.origin + "/privacy/", "en", "website")}<main class="reading-body"><article class="article" id="article"><div class="eyebrow">~/privacy</div><h1>Privacy &amp; Cookies</h1><div class="article-prose">${privacy}</div></article></main>${footer}</body></html>`,
  );
  for (const p of posts) {
    const url = `${config.origin}/posts/${p.slug}/`;
    await fs.mkdir(`${out}/posts/${p.slug}`, { recursive: true });
    const article = `<article class="article" id="article" lang="${p.lang}" data-post="${p.slug}"><div class="article-top"><a href="/journal/">← Journal</a><span>${e(p.date)} · ${p.minutes} min read</span></div><h1>${e(p.title)}</h1><p class="article-description">${e(p.description)}</p>${p.sample ? '<aside class="demo-notice">Sample entry · written to demonstrate the journal. Replace with your own writing.</aside>' : ""}<div class="article-prose">${p.html}</div><section class="reactions" data-reactions="${p.slug}" aria-label="React to this post"></section></article>`;
    await fs.writeFile(
      `${out}/posts/${p.slug}/index.html`,
      `${head(p.title, p.description, url, p.lang).replace("</head>", `${p.sample ? '<meta name="robots" content="noindex">' : ""}<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: p.description, datePublished: p.date, inLanguage: p.lang, author: { "@type": "Person", name: config.author }, url }).replace(/</g, "\\u003c")}</script></head>`)}<main class="reading-body">${article}</main>${footer}</body></html>`,
    );
    await fs.writeFile(
      `${out}/posts/${p.slug}/data.json`,
      JSON.stringify({ ...p, article }),
    );
  }
  const rows = posts
    .map(
      (p) =>
        `<a class="post-row" href="/posts/${p.slug}/"><div class="post-meta"><time>${e(p.date)}</time><span class="post-tag">${e(p.tags[0] || "notes")}</span>${p.sample ? '<span class="sample-label">sample</span>' : ""}</div><h3>${e(p.title)}<span>↗</span></h3><p>${e(p.description)}</p><div class="post-foot">${p.minutes} min read · ${p.lang.toUpperCase()}</div></a>`,
    )
    .join("");
  await fs.mkdir(`${out}/journal`, { recursive: true });
  await fs.writeFile(
    `${out}/journal/index.html`,
    `${head("Journal", config.description, config.origin + "/journal/")}<main class="journal-page" id="article"><div class="eyebrow">~/journal</div><div class="journal-heading"><div><h1>Thinking out loud.</h1><p>Experiments, rabbit holes, and ordinary life.</p></div></div>${rows || '<p class="empty-state">The first entry is still ahead.</p>'}</main>${footer}</body></html>`,
  );
  const xml = (s) => e(s);
  await fs.writeFile(
    `${out}/feed.xml`,
    `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>OS_MAN journal</title><link>${xml(config.origin)}</link><description>${xml(config.description)}</description>${posts
      .filter((p) => !p.sample)
      .map(
        (p) =>
          `<item><title>${xml(p.title)}</title><link>${xml(config.origin + "/posts/" + p.slug + "/")}</link><guid>${xml(config.origin + "/posts/" + p.slug + "/")}</guid><description>${xml(p.description)}</description><pubDate>${new Date(p.date).toUTCString()}</pubDate></item>`,
      )
      .join("")}</channel></rss>`,
  );
  const routes = [
    "/",
    "/journal/",
    "/privacy/",
    ...posts.filter((p) => !p.sample).map((p) => `/posts/${p.slug}/`),
  ];
  await fs.writeFile(
    `${out}/sitemap.xml`,
    `<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((p) => `<url><loc>${xml(config.origin + p)}</loc></url>`).join("")}</urlset>`,
  );
  await fs.writeFile(
    `${out}/robots.txt`,
    `User-agent: *\nAllow: /\nSitemap: ${config.origin}/sitemap.xml\n`,
  );
  let home = await fs.readFile(`${out}/index.html`, "utf8");
  home = home.replace(
    "</head>",
    `<link rel="canonical" href="${e(config.origin)}/"><meta property="og:title" content="OS_MAN — A personal workspace"><meta property="og:description" content="${e(config.description)}"><meta property="og:type" content="website"><meta property="og:url" content="${e(config.origin)}/"></head>`,
  );
  await fs.writeFile(`${out}/index.html`, home);
  await fs.writeFile(
    `${out}/404.html`,
    `${head("Window not found", "This page does not exist.", config.origin + "/404")}<main class="journal-page"><div class="eyebrow">404 / not found</div><h1>This window leads nowhere.</h1><p class="empty-state">The page may have moved. There is plenty to explore back at the desktop.</p><a href="/">← Back home</a></main>${footer}</body></html>`,
  );
  const clientBuild = await build({
    entryPoints: { desktop: "main.js", reading: "reading.js" },
    outdir: out + "/assets",
    bundle: true,
    format: "esm",
    target: "es2022",
    entryNames: "[name]-[hash]",
    metafile: true,
    loader: { ".md": "text" },
  });
  const entries = Object.entries(clientBuild.metafile.outputs);
  const desktop =
    "/" +
    entries
      .find(([, v]) => v.entryPoint === "main.js")[0]
      .replace(out + "/", "");
  const reader =
    "/" +
    entries
      .find(([, v]) => v.entryPoint === "reading.js")[0]
      .replace(out + "/", "");
  await fs.writeFile(
    out + "/index.html",
    (await fs.readFile(out + "/index.html", "utf8")).replace(
      'src="/main.js"',
      `src="${desktop}"`,
    ),
  );
  for (const filename of [
    `${out}/journal/index.html`,
    `${out}/privacy/index.html`,
    `${out}/404.html`,
    ...posts.map((p) => `${out}/posts/${p.slug}/index.html`),
  ]) {
    await fs.writeFile(
      filename,
      (await fs.readFile(filename, "utf8")).replace(
        'src="/reading.js"',
        `src="${reader}"`,
      ),
    );
  }
  await fs.mkdir("dist/server", { recursive: true });
  await build({
    entryPoints: ["server/vercel.js"],
    outfile: "dist/server/index.mjs",
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node24",
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
    define: {
      __POST_SLUGS__: JSON.stringify(posts.map((p) => p.slug)),
    },
  });
  await writeVercelOutput(posts);
  console.log(`Built ${posts.length} posts and the desktop.`);
}
if (process.argv[1]?.endsWith("/build.mjs")) await buildSite();
