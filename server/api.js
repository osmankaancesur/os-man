const kinds = ["love", "interesting", "inspired"];
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function handleApi(request, env, posts = []) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  const table = "guestbook";
  const prior = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)visitor=([^;]+)/)?.[1];
  const visitor = uuid.test(prior || "") ? prior : crypto.randomUUID();
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (visitor !== prior)
    headers["Set-Cookie"] =
      `visitor=${visitor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol === "https:" ? "; Secure" : ""}`;
  const reply = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  const db = env.DB;
  if (!db)
    return reply(
      {
        error:
          "The guestbook is temporarily unavailable. Please try again later.",
      },
      503,
    );
  try {
    const write = request.method !== "GET";
    let body;
    if (write) {
      if (request.headers.get("origin") !== url.origin)
        return reply({ error: "Please submit from this website." }, 403);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "Expected JSON." }, 415);
      const reader = request.body?.getReader();
      let raw = "",
        size = 0;
      const decoder = new TextDecoder();
      if (!reader) return reply({ error: "Missing request body." }, 400);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          return reply({ error: "Message is too long." }, 413);
        }
        raw += decoder.decode(value, { stream: true });
      }
      try {
        body = JSON.parse(raw + decoder.decode());
      } catch {
        return reply({ error: "Invalid request." }, 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        return reply({ error: "Invalid request." }, 400);
      const now = Date.now();
      const budget = await db
        .prepare(
          "INSERT INTO limits(visitor,started,count) VALUES(?,?,1) ON CONFLICT(visitor) DO UPDATE SET started=CASE WHEN started<? THEN excluded.started ELSE started END,count=CASE WHEN started<? THEN 1 ELSE count+1 END RETURNING count",
        )
        .bind(visitor, now, now - 60000, now - 60000)
        .first();
      if (budget.count > 20)
        return reply(
          { error: "A little too fast. Try again in a minute." },
          429,
        );
    }
    if (url.pathname === "/api/guestbook") {
      if (request.method === "GET") {
        const before = Number(
            url.searchParams.get("before") || Number.MAX_SAFE_INTEGER,
          ),
          id = url.searchParams.get("id") || "~";
        if (!Number.isSafeInteger(before) || id.length > 40)
          return reply({ error: "Invalid page." }, 400);
        const { results } = await db
          .prepare(
            `SELECT id,name,message,created_at FROM ${table} WHERE created_at<? OR (created_at=? AND id<?) ORDER BY created_at DESC,id DESC LIMIT 9`,
          )
          .bind(before, before, id)
          .all();
        const entries = results.slice(0, 8),
          last = entries.at(-1);
        return reply({
          entries,
          next:
            results.length > 8
              ? { before: last.created_at, id: last.id }
              : null,
        });
      }
      if (request.method === "POST") {
        if (body.website)
          return reply({ error: "Unable to submit this message." }, 400);
        const name = typeof body.name === "string" ? body.name.trim() : "",
          message = typeof body.message === "string" ? body.message.trim() : "";
        if (!name || name.length > 50 || !message || message.length > 250)
          return reply(
            {
              error:
                "Use a name of 1–50 characters and a message of 1–250 characters.",
            },
            400,
          );
        const id = crypto.randomUUID(),
          now = Date.now();
        const result = await db
          .prepare(
            `INSERT INTO ${table}(id,name,message,visitor,created_at) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM ${table} WHERE visitor=? AND created_at>?)`,
          )
          .bind(id, name, message, visitor, now, visitor, now - 60000)
          .run();
        if (!result.meta.changes)
          return reply(
            {
              error:
                "Thanks for stopping by. Please wait a minute before leaving another note.",
            },
            429,
          );
        return reply({ entry: { id, name, message, created_at: now } }, 201);
      }
      return reply({ error: "Method not allowed." }, 405);
    }
    const match = url.pathname.match(/^\/api\/reactions\/([a-z0-9-]+)$/);
    if (match && posts.includes(match[1])) {
      const post = match[1];
      if (request.method === "PUT") {
        if (body.kind !== null && !kinds.includes(body.kind))
          return reply({ error: "Choose a valid reaction." }, 400);
        if (body.kind === null)
          await db
            .prepare("DELETE FROM reactions WHERE post=? AND visitor=?")
            .bind(post, visitor)
            .run();
        else
          await db
            .prepare(
              "INSERT INTO reactions(post,visitor,kind,created_at) VALUES(?,?,?,?) ON CONFLICT(post,visitor) DO UPDATE SET kind=excluded.kind,created_at=excluded.created_at",
            )
            .bind(post, visitor, body.kind, Date.now())
            .run();
      } else if (request.method !== "GET")
        return reply({ error: "Method not allowed." }, 405);
      const { results } = await db
        .prepare(
          "SELECT kind,count(*) AS total FROM reactions WHERE post=? GROUP BY kind",
        )
        .bind(post)
        .all();
      const mine = await db
        .prepare("SELECT kind FROM reactions WHERE post=? AND visitor=?")
        .bind(post, visitor)
        .first();
      return reply({
        counts: Object.fromEntries(
          kinds.map((k) => [k, results.find((r) => r.kind === k)?.total || 0]),
        ),
        mine: mine?.kind || null,
      });
    }
    return reply({ error: "Not found." }, 404);
  } catch (error) {
    console.error("Community API failure", error?.message);
    return reply({ error: "Something went wrong. Please try again." }, 503);
  }
}
