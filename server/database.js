import { createClient } from "@libsql/client/http";

// The shared query interface keeps the SQLite schema and parameterized queries
// identical in local development and on Turso. No D1 binding is needed.
export function databaseFromClient(client) {
  return {
    close: () => client.close(),
    prepare(sql) {
      let args = [];
      const execute = () => client.execute({ sql, args });
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return (await execute()).rows[0] || null;
        },
        async all() {
          return { results: (await execute()).rows };
        },
        async run() {
          return { meta: { changes: (await execute()).rowsAffected } };
        },
      };
    },
  };
}

export function createRemoteClient(env = process.env) {
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN)
    throw Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
  const url = new URL(env.TURSO_DATABASE_URL);
  if (
    !["libsql:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("Use a secure remote Turso database URL.");
  // HTTP transport requires no sockets, native bindings or writable filesystem.
  return createClient({
    url: url.href.replace(/^libsql:/, "https:"),
    authToken: env.TURSO_AUTH_TOKEN,
    intMode: "number",
  });
}

let database;
export function getDatabase() {
  if (!database) database = databaseFromClient(createRemoteClient());
  return database;
}
