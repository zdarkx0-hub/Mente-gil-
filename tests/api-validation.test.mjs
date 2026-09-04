import assert from "node:assert/strict";
import test from "node:test";
import { createSiteFixture } from "./site-fixture.mjs";

test("malformed object payloads return clear client errors; private IDs stay server-side", async () => {
  const { sqlite, call } = await createSiteFixture();
  try {
    for (const path of ["/api/account/register", "/api/ranking/session", "/api/review/errors", "/api/review/errors/answer"]) {
      for (const body of [null, [], 42, "text"]) {
        const result = await call(path, { user: path === "/api/account/register" ? "new-player" : "player-a", body });
        assert.equal(result.status, 400, `${path} must reject ${JSON.stringify(body)}`);
      }
      assert.equal((await call(path, { body: {}, origin: "" })).status, 403);
    }
    assert.equal((await call("/api/account/register", { user: "new-player", body: { nickname: "Nova pessoa" } })).status, 201);
    const account = (await call("/api/account")).data.account;
    assert.deepEqual(Object.keys(account).sort(), ["createdAt", "nickname"]);
    assert.equal((await call("/api/review/errors", { body: { operation: "add", level: 1, a: 10, b: 5, expectedAnswer: 15, lastGiven: 14 } })).status, 201);
    const own = (await call("/api/review/errors")).data;
    assert.equal(own.errors.length, 1);
    assert.doesNotMatch(JSON.stringify(own), /h1:|userId|user_id/);
    assert.equal((await call("/api/review/errors", { user: "player-b" })).data.errors.length, 0);
  } finally { sqlite.close(); }
});
