import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { build } from "esbuild";

test("retired admin routes cannot access the database or use an old session", async () => {
  const bundled = await build({
    entryPoints: [new URL("../worker/index.ts", import.meta.url).pathname],
    bundle: true, write: false, format: "esm", platform: "neutral",
    plugins: [{ name: "stub-pages", setup(builder) {
      builder.onResolve({ filter: /^vinext\/server\/fetch-handler$/ }, () => ({ path: "pages", namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
        contents: "export default {fetch(){return new Response('page')}}", loader: "js"
      }));
    } }]
  });
  const { default: worker } = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
  const env = { DB: new Proxy({}, { get() { throw new Error("Retired route touched the database"); } }) };
  const headers = { cookie: "__Host-mente_agil_admin=old-session", "oai-authenticated-user-id": "test-owner" };
  for (const method of ["GET", "POST", "DELETE"]) {
    for (const path of ["/api/admin", "/api/admin/login", "/api/admin/session", "/api/admin/overview", "/api/admin/users/test/history", "/api/admin/users/test"]) {
      const response = await worker.fetch(new Request("https://test.invalid" + path, { method, headers }), env, {});
      assert.equal(response.status, 410);
      assert.deepEqual(await response.json(), { error: "Recurso removido." });
      assert.ok(response.headers.get("set-cookie").includes("Max-Age=0"));
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  }
  for (const path of ["/admin", "/admin/"]) {
    const response = await worker.fetch(new Request("https://test.invalid" + path, { headers }), env, {});
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/");
  }
  const header = await readFile(new URL("../app/auth-header.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(header, /AdminLink|\/admin/);
  const navigation = await readFile(new URL("../app/study-navigation.jsx", import.meta.url), "utf8");
  assert.match(navigation, /\["\/revisar", "Revisar"\]/);
  assert.match(header, /Criar conta/);
});
