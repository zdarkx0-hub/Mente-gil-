const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const app = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/app.js"), "utf8");
// Run the actual storage startup. Rendering is irrelevant to this storage regression.
const startup = app.replace(/  bindEvents\(\);\n  saveData\(false\);\n  renderAll\(\);\n\}\)\(\);\s*$/,
  "  saveData(false);\n})();");
assert.notEqual(startup, app);

test("reopening beta preserves history, preferences, ranking identity and medals", () => {
  const original = {
    version: 3,
    installId: "beta-tester-1234567890",
    profile: {name: "Teste", sound: false, theme: "rose", publicMedals: ["ranked-first"]},
    rankingEligibleMedals: ["ranked-first"],
    sessions: [{operation: "add", level: "base", startedAt: 1700000000000,
      correct: 1, wrong: 1, answers: [{a: 4, b: 5, expected: 9, given: 9},
        {a: 7, b: 6, expected: 13, given: 12}]}]
  };
  let stored = JSON.stringify(original);
  for (let reopen = 0; reopen < 3; reopen++) {
    const document = {documentElement: {dataset: {}}, body: {dataset: {}}};
    const window = {MenteAgilData: {load: () => stored, save: (value) => {stored = value; return true;}}};
    vm.runInNewContext(startup, {window, document});
    assert.deepEqual(JSON.parse(stored), original);
    assert.equal(document.body.dataset.theme, "rose");
  }
});

test("connecting and switching accounts preserves each history without mixing accounts", () => {
  const training = (id) => ({id, operation: "add", level: "base", mode: "count", goal: 10,
    startedAt: 1700000000000, finishedAt: 1700000000100, correct: 1, wrong: 0,
    answers: [{a: 2, b: 3, expected: 5, given: 5, correct: true, elapsedMs: 100}]});
  let stored = JSON.stringify({version: 3, installId: "beta-existing-1234567890",
    profile: {name: "Teste", sound: false, theme: "rose", publicMedals: []},
    rankingEligibleMedals: [], sessions: [training("guest-training")]});
  let owner = "";
  const slots = new Map();
  const fields = new Map();
  const document = {documentElement: {dataset: {}}, body: {dataset: {}},
    querySelector(selector) { if (!fields.has(selector)) fields.set(selector, {}); return fields.get(selector); }};
  const window = {MenteCore: require("../app/src/main/assets/www/core.js"), MenteAgilData: {
    load: () => stored, save: value => {stored = value; return true;},
    loadAccountSlot: () => slots.get(owner) || "",
    saveAccountSlot: value => { if ((JSON.parse(value).accountId || "") !== owner) return false; slots.set(owner, value); return true; },
    adoptGuestPhoto: () => {}
  }};
  vm.runInNewContext(startup.replace("  saveData(false);\n})();", "  renderAll = () => {};\n  saveData(false);\n})();"), {window, document});
  const accountA = {id: "account-a", publicId: "MA-AAAA", name: "Mesmo nome"};
  const accountB = {id: "account-b", publicId: "MA-BBBB", name: "Mesmo nome"};
  const appApi = window.MenteApp;
  owner = accountA.id; appApi.connect(accountA);
  assert.equal(appApi.snapshot().sessions[0].id, "guest-training");
  assert.equal(appApi.snapshot().profile.theme, "rose");
  appApi.mergeHistory([training("account-a-training")], 100);
  owner = ""; appApi.disconnect();
  assert.equal(appApi.snapshot().sessions.length, 0);
  owner = accountB.id; appApi.connect(accountB);
  assert.equal(appApi.snapshot().sessions.length, 0);
  appApi.mergeHistory([training("account-b-training")], 200);
  owner = ""; appApi.disconnect();
  owner = accountA.id; appApi.connect(accountA);
  assert.deepEqual(Array.from(appApi.snapshot().sessions, s => s.id).sort(), ["account-a-training", "guest-training"]);
  assert.equal(appApi.snapshot().profile.theme, "rose");
  assert.equal(appApi.snapshot().profile.sound, false);
  assert.equal(JSON.parse(slots.get(accountB.id)).sessions[0].id, "account-b-training");
});
