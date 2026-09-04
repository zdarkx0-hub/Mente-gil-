import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";

// Every test gets disposable SQLite data and fake credentials. No production I/O.
export async function createSiteFixture() {
  const sqlite = new DatabaseSync(":memory:");
  const source = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  for (const table of ["ranking_entries_v2", "ranking_sessions_v2"]) {
    sqlite.exec(source.match(new RegExp("CREATE TABLE IF NOT EXISTS " + table + " \\([\\s\\S]*?\\)\\x60"))[0].slice(0, -1));
  }
  for (const name of (await readdir(new URL("../drizzle/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(await readFile(new URL("../drizzle/" + name, import.meta.url), "utf8"));
  }
  sqlite.exec("PRAGMA optimize");
  for (const id of [...source.matchAll(/id: "([^"]+)"/g)].map((item) => item[1]).concat("pseudonymize-user-identifiers-hmac-v1")) {
    sqlite.prepare("INSERT OR IGNORE INTO ranking_moderation_actions_v1 VALUES (?, ?)").run(id, 1);
  }
  const secret = "isolated-test-key-not-a-production-secret";
  const key = (user) => "h1:" + createHmac("sha256", secret).update(user).digest("hex");
  for (const user of ["player-a", "player-b"]) {
    sqlite.prepare("INSERT INTO ranking_accounts_v1 VALUES (?, ?, ?, ?)").run(key(user), user, user, 1);
  }
  const DB = {
    prepare(sql) {
      const wrap = (params = []) => ({
        bind: (...values) => wrap(values),
        first: async () => sqlite.prepare(sql).get(...params) ?? null,
        all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
        run: async () => ({ success: true, meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } })
      });
      return wrap();
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    }
  };
  const bundled = await build({
    entryPoints: [new URL("../worker/index.ts", import.meta.url).pathname],
    bundle: true, write: false, format: "esm", platform: "neutral",
    plugins: [{ name: "stub-pages", setup(builder) {
      builder.onResolve({ filter: /^vinext\/server\/fetch-handler$/ }, () => ({ path: "pages", namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export default {fetch(){return new Response('page')}}", loader: "js" }));
    } }]
  });
  const { default: worker } = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
  const call = async (path, { user = "player-a", body, origin = "https://test.invalid", env, now } = {}) => {
    const realNow = Date.now;
    if (now !== undefined) Date.now = () => now;
    try {
      const headers = { origin, "content-type": "application/json" };
      if (user) headers["oai-authenticated-user-id"] = user;
      const response = await worker.fetch(new Request("https://test.invalid" + path, {
        method: body === undefined ? "GET" : "POST", headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      }), env ?? { DB, USER_DATA_HMAC_SECRET: secret }, {});
      assert.equal(response.headers.get("cache-control"), "no-store");
      return { status: response.status, data: await response.json() };
    } finally { Date.now = realNow; }
  };
  return { sqlite, key, call };
}
