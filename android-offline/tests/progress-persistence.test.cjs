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
