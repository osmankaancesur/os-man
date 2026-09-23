import { handleApi } from "./api.js";

// Standard Node request/response entrypoint used by Vercel's Nodejs launcher.
export function createNodeHandler({ getEnv, posts = [] }) {
  return async (req, res) => {
    try {
      const env = await getEnv();
      const host = req.headers.host;
      if (
        !host ||
        !/^[a-z0-9.:[\]-]+$/i.test(host) ||
        !req.url.startsWith("/") ||
        req.url.startsWith("//")
      ) {
        res.writeHead(400);
        res.end("Invalid request");
        return;
      }
      const url = new URL(
        req.url,
        `${env.LOCAL_DEV ? "http" : "https"}://${host}`,
      );
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (value !== undefined)
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      const request = new Request(url, {
        method: req.method,
        headers,
        ...(!["GET", "HEAD"].includes(req.method)
          ? { body: req, duplex: "half" }
          : {}),
      });
      const response =
        (await handleApi(request, env, posts)) ||
        Response.json({ error: "Not found." }, { status: 404 });
      const outgoing = Object.fromEntries(response.headers);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) outgoing["set-cookie"] = cookies;
      res.writeHead(response.status, outgoing);
      res.end(
        req.method === "HEAD"
          ? undefined
          : Buffer.from(await response.arrayBuffer()),
      );
    } catch {
      // Configuration/database failures must not expose secrets or private data.
      console.error("Website API unavailable.");
      res.writeHead(503, {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      });
      res.end(
        JSON.stringify({
          error: "The service is temporarily unavailable. Please try again.",
        }),
      );
    }
  };
}
