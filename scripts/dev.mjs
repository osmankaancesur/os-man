import { createNodeHandler } from "../server/node-handler.js";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { buildSite } from "./build.mjs";
import { readPosts } from "./content.mjs";
import { openDatabase } from "./local-db.mjs";
await buildSite();
await fs.mkdir(".data", { recursive: true });
const DB = openDatabase(".data/community.sqlite");
const root = path.resolve("dist/client");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://" + req.headers.host);
      if (url.pathname.startsWith("/api/")) {
        await createNodeHandler({
          getEnv: () => ({
            DB,
            LOCAL_DEV: true,
          }),
          posts: (await readPosts()).map((p) => p.slug),
        })(req, res);
        return;
      }
      let filename = path.resolve(root, "." + decodeURIComponent(url.pathname));
      if (filename !== root && !filename.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        if ((await fs.stat(filename)).isDirectory())
          filename = path.join(filename, "index.html");
      } catch {}
      let data,
        status = 200;
      try {
        data = await fs.readFile(filename);
      } catch {
        data = await fs.readFile(root + "/404.html");
        filename = "404.html";
        status = 404;
      }
      res.writeHead(status, {
        "Content-Type":
          mime[path.extname(filename)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch (error) {
      console.error(error.message);
      res.writeHead(500);
      res.end("Server error");
    }
  })
  .listen(8002, "127.0.0.1", () =>
    console.log(
      "Local: http://127.0.0.1:8002 — run npm run build after edits.",
    ),
  );
