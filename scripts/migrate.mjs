import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createRemoteClient } from "../server/database.js";
import { loadLocalEnv } from "./env.mjs";

export async function migrate(client, directory = "drizzle") {
  const files = (await fs.readdir(directory))
    .filter((n) => n.endsWith(".sql"))
    .sort();
  // One write transaction serializes schema changes and records them atomically.
  const tx = await client.transaction("write");
  const applied = [];
  try {
    await tx.execute(
      "CREATE TABLE IF NOT EXISTS _os_man_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)",
    );
    for (const name of files) {
      const source = await fs.readFile(`${directory}/${name}`, "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      const prior = (
        await tx.execute({
          sql: "SELECT checksum FROM _os_man_migrations WHERE name=?",
          args: [name],
        })
      ).rows[0];
      if (prior) {
        if (prior.checksum !== checksum)
          throw Error(`Applied migration changed: ${name}`);
        continue;
      }
      for (const sql of source
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean))
        await tx.execute(sql);
      await tx.execute({
        sql: "INSERT INTO _os_man_migrations(name,checksum) VALUES(?,?)",
        args: [name, checksum],
      });
      applied.push(name);
    }
    await tx.commit();
    return applied;
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  loadLocalEnv();
  const client = createRemoteClient();
  try {
    console.log("Migrations applied:", await migrate(client));
  } finally {
    client.close();
  }
}
