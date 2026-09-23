import fs from "node:fs/promises";

export const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export async function writeVercelOutput(posts) {
  const out = ".vercel/output";
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(`${out}/functions/api.func`, { recursive: true });
  await fs.cp("dist/client", `${out}/static`, { recursive: true });
  await fs.copyFile(
    "dist/server/index.mjs",
    `${out}/functions/api.func/index.mjs`,
  );
  await fs.writeFile(
    `${out}/functions/api.func/.vc-config.json`,
    JSON.stringify(
      {
        runtime: "nodejs24.x",
        handler: "index.mjs",
        launcherType: "Nodejs",
        maxDuration: 30,
      },
      null,
      2,
    ),
  );
  const pages = [
    "/journal",
    "/privacy",
    ...posts.map((p) => `/posts/${p.slug}`),
  ];
  const preview = process.env.VERCEL_ENV === "preview";
  await fs.writeFile(
    `${out}/config.json`,
    JSON.stringify(
      {
        version: 3,
        routes: [
          {
            src: "^/(.*)$",
            headers: {
              ...securityHeaders,
              ...(preview ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
            },
            continue: true,
          },
          { src: "^/api(?:/.*)?$", dest: "/api" },
          {
            src: "^/assets/(?:desktop|reading)-[A-Z0-9]+\\.js$",
            headers: { "Cache-Control": "public, max-age=31536000, immutable" },
            continue: true,
          },
          {
            src: "^/(?:feed|sitemap)\\.xml$",
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=0, must-revalidate",
            },
            continue: true,
          },
          { src: "^/index\\.html$", headers: { Location: "/" }, status: 308 },
          { src: "^/$", dest: "/index.html" },
          ...pages.flatMap((page) => [
            {
              src: `^${page}(?:/index\\.html)?$`,
              headers: { Location: `${page}/` },
              status: 308,
            },
            { src: `^${page}/$`, dest: `${page}/index.html` },
          ]),
          { handle: "filesystem" },
          { src: "^/.*$", dest: "/404.html", status: 404 },
        ],
      },
      null,
      2,
    ),
  );
}
