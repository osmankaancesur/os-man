import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
export function openDatabase(filename = ":memory:") {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec("PRAGMA journal_mode=WAL");
  sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations(name TEXT PRIMARY KEY)");
  for (const name of fs
    .readdirSync("drizzle")
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (sqlite.prepare("SELECT name FROM _migrations WHERE name=?").get(name))
      continue;
    sqlite.exec("BEGIN");
    try {
      sqlite.exec(fs.readFileSync("drizzle/" + name, "utf8"));
      sqlite.prepare("INSERT INTO _migrations(name) VALUES(?)").run(name);
      sqlite.exec("COMMIT");
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  }
  return {
    close: () => sqlite.close(),
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return stmt.get(...args) || null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          return { meta: stmt.run(...args) };
        },
      };
    },
  };
}
