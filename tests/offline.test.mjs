import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("offline vault encrypts private cache and queued mutations", async () => {
  const source = await readFile(new URL("app/offline-client.js", root), "utf8");
  assert.match(source, /AES-GCM/);
  assert.match(source, /generateKey/);
  assert.match(source, /false, \["encrypt", "decrypt"\]/);
  assert.match(source, /sync-queue/);
  assert.match(source, /postJsonOrQueue/);
  assert.match(source, /syncPendingMutations/);
  assert.doesNotMatch(source, /USER_DATA_HMAC_SECRET|password|senha\s*:/i);
});

test("timed training supports local sessions without enabling offline ranking", async () => {
  const study = await readFile(new URL("app/study-app.jsx", root), "utf8");
  const worker = await readFile(new URL("worker/achievements.ts", root), "utf8");
  assert.match(study, /trainingSessionOfflineRef/);
  assert.match(study, /crypto\.randomUUID\(\)/);
  assert.match(study, /O ranking precisa de internet/);
  assert.match(study, /postJsonOrQueue\("\/api\/achievements\/complete"/);
  assert.match(worker, /body\.offline !== true/);
  assert.match(worker, /90 \* 86_400_000/);
  assert.match(worker, /practice_errors_v1/);
});

test("private API snapshots are handled by the encrypted client vault, not the service worker cache", async () => {
  const worker = await readFile(new URL("public/sw.js", root), "utf8");
  const source = await readFile(new URL("app/offline-client.js", root), "utf8");
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(source, /apiCacheKey/);
  assert.match(source, /privateJsonFetch/);
});
