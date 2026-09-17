const test = require("node:test");
const assert = require("node:assert/strict");
const createStore = require("../app/src/main/assets/www/data-store.js");
const catalog = require("../app/src/main/assets/www/catalog.js");

test("merging old sessions without IDs preserves distinct history and deduplicates copies", () => {
  const store = createStore({}, catalog, () => {});
  const first = {
    operation: "add",
    level: "base",
    startedAt: 100,
    answers: [],
  };
  const second = {
    operation: "sub",
    level: "base",
    startedAt: 200,
    answers: [],
  };
  store.getData().sessions = [first, second];
  store.mergeHistory([structuredClone(first), structuredClone(second)], 300);
  assert.deepEqual(store.snapshot().sessions, [first, second]);
});

test("backup restore preserves the current account, installation and verified medals", () => {
  const store = createStore({}, catalog, () => {});
  store.connect({ id: "owner-a", publicId: "MA-A", name: "Tester" });
  const before = store.snapshot();
  const restored = store.sanitizeImportedBackup({
    backupVersion: 1,
    accountId: "owner-b",
    installId: "foreign-id",
    rankingEligibleMedals: ["ranked-thousand"],
    sessions: [],
    profile: {
      name: "Imported",
      theme: "rose",
      publicMedals: ["ranked-thousand"],
    },
  });
  assert.equal(restored.accountId, before.accountId);
  assert.equal(restored.installId, before.installId);
  assert.deepEqual(restored.rankingEligibleMedals, []);
  assert.deepEqual(restored.profile.publicMedals, []);
  assert.equal(restored.profile.theme, "rose");
});

test("reopening beta preserves history, preferences, ranking identity and medals", () => {
  const original = {
    version: 3,
    installId: "beta-tester-1234567890",
    profile: {
      name: "Teste",
      sound: false,
      theme: "rose",
      publicMedals: ["ranked-first"],
    },
    rankingEligibleMedals: ["ranked-first"],
    sessions: [
      {
        operation: "add",
        level: "base",
        startedAt: 1700000000000,
        correct: 1,
        wrong: 1,
        answers: [
          { a: 4, b: 5, expected: 9, given: 9 },
          { a: 7, b: 6, expected: 13, given: 12 },
        ],
      },
    ],
  };
  let stored = JSON.stringify(original);
  for (let reopen = 0; reopen < 3; reopen++) {
    const window = {
      MenteAgilData: {
        load: () => stored,
        save: (value) => {
          stored = value;
          return true;
        },
      },
    };
    const store = createStore(window, catalog, assert.fail);
    store.save(false);
    assert.deepEqual(JSON.parse(stored), original);
    assert.equal(store.snapshot().profile.theme, "rose");
  }
});

test("connecting and switching accounts preserves each history without mixing accounts", () => {
  const training = (id) => ({
    id,
    operation: "add",
    level: "base",
    mode: "count",
    goal: 10,
    startedAt: 1700000000000,
    finishedAt: 1700000000100,
    correct: 1,
    wrong: 0,
    answers: [
      { a: 2, b: 3, expected: 5, given: 5, correct: true, elapsedMs: 100 },
    ],
  });
  let stored = JSON.stringify({
    version: 3,
    installId: "beta-existing-1234567890",
    profile: { name: "Teste", sound: false, theme: "rose", publicMedals: [] },
    rankingEligibleMedals: [],
    sessions: [training("guest-training")],
  });
  let owner = "";
  const slots = new Map();
  const window = {
    MenteCore: require("../app/src/main/assets/www/core.js"),
    MenteAgilData: {
      load: () => stored,
      save: (value) => {
        stored = value;
        return true;
      },
      loadAccountSlot: () => slots.get(owner) || "",
      saveAccountSlot: (value) => {
        if ((JSON.parse(value).accountId || "") !== owner) return false;
        slots.set(owner, value);
        return true;
      },
      adoptGuestPhoto: () => {},
    },
  };
  const appApi = createStore(window, catalog, assert.fail);
  appApi.save(false);
  const accountA = { id: "account-a", publicId: "MA-AAAA", name: "Mesmo nome" };
  const accountB = { id: "account-b", publicId: "MA-BBBB", name: "Mesmo nome" };
  owner = accountA.id;
  appApi.connect(accountA);
  assert.equal(appApi.snapshot().sessions[0].id, "guest-training");
  assert.equal(appApi.snapshot().profile.theme, "rose");
  appApi.mergeHistory([training("account-a-training")], 100);
  owner = "";
  appApi.disconnect();
  assert.equal(appApi.snapshot().sessions.length, 0);
  owner = accountB.id;
  appApi.connect(accountB);
  assert.equal(appApi.snapshot().sessions.length, 0);
  appApi.mergeHistory([training("account-b-training")], 200);
  owner = "";
  appApi.disconnect();
  owner = accountA.id;
  appApi.connect(accountA);
  assert.deepEqual(Array.from(appApi.snapshot().sessions, (s) => s.id).sort(), [
    "account-a-training",
    "guest-training",
  ]);
  assert.equal(appApi.snapshot().profile.theme, "rose");
  assert.equal(appApi.snapshot().profile.sound, false);
  assert.equal(
    JSON.parse(slots.get(accountB.id)).sessions[0].id,
    "account-b-training",
  );
});
