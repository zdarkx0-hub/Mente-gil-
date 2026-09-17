const test = require("node:test");
const assert = require("node:assert/strict");
const createClient = require("../app/src/main/assets/www/native-request.js");

function fixture(sendOverride) {
  const calls = [],
    timers = new Map();
  let timerId = 0;
  const client = createClient({
    prefix: "test",
    timeout: 100,
    timeoutMessage: "timeout",
    invalidMessage: "invalid",
    now: () => 123,
    schedule: (callback) => {
      timers.set(++timerId, callback);
      return timerId;
    },
    cancel: (id) => timers.delete(id),
    send: sendOverride || ((...args) => calls.push(args)),
  });
  return { client, calls, timers };
}

test("native replies are matched independently even when delivered out of order", async () => {
  const { client, calls, timers } = fixture();
  const first = client.request("first"),
    second = client.request("second");
  client.resolve(calls[1][0], '{"value":2}');
  client.resolve(calls[0][0], '{"value":1}');
  assert.deepEqual(await first, { value: 1 });
  assert.deepEqual(await second, { value: 2 });
  client.resolve(calls[0][0], '{"value":999}');
  assert.equal(timers.size, 0);
});

test("timeout releases the callback and ignores a late native reply", async () => {
  const { client, calls, timers } = fixture();
  const result = client.request("slow");
  const rejected = assert.rejects(result, /timeout/);
  [...timers.values()][0]();
  await rejected;
  client.resolve(calls[0][0], '{"value":1}');
  assert.equal(timers.size, 0);
});

test("a synchronous native failure cleans up its timer", async () => {
  const { client, timers } = fixture(() => {
    throw new Error("bridge unavailable");
  });
  await assert.rejects(client.request("action"), /bridge unavailable/);
  assert.equal(timers.size, 0);
});

test("malformed payloads and server errors reject without leaking pending work", async () => {
  for (const raw of ["{", "null", "[]", '{"error":"server failure"}']) {
    const { client, calls, timers } = fixture();
    const result = client.request("action");
    client.resolve(calls[0][0], raw);
    await assert.rejects(result, /invalid|server failure/);
    assert.equal(timers.size, 0);
  }
});
