const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

const entry = path.join(__dirname, "../app/src/main/assets/www/index.html");
const seed = () => ({
  version: 3,
  installId: "beta-tester-1234567890",
  profile: { name: "Tester", sound: false, theme: "rose", publicMedals: [] },
  rankingEligibleMedals: [],
  sessions: [],
});

async function mount(initial = seed()) {
  let stored = JSON.stringify(initial);
  const errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (error) => errors.push(error.message));
  const dom = await JSDOM.fromFile(entry, {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: console,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.MenteAgilConnectivity = { getStatus: () => "offline" };
      window.MenteAgilAccount = { connected: () => false };
      window.MenteAgilData = {
        load: () => stored,
        save: (json) => {
          stored = json;
          return true;
        },
        saveAccountSlot: () => true,
        loadAccountSlot: () => "",
        profilePhoto: () => "",
        // Test the JS/Android backup contract; native encryption is unchanged.
        exportBackup: (json) => "test-encrypted:" + json,
        importBackup: (payload) =>
          payload.startsWith("test-encrypted:") ? payload.slice(15) : "",
      };
    },
  });
  await new Promise((resolve) =>
    dom.window.addEventListener("load", resolve, { once: true }),
  );
  const $ = (selector) => dom.window.document.querySelector(selector);
  return { dom, $, errors, stored: () => JSON.parse(stored) };
}

async function waitFor(check) {
  const until = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > until) throw new Error("UI transition did not finish");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test("real HTML loads every module offline and completes a 10-question training", async () => {
  const view = await mount();
  try {
    const { window } = view.dom;
    assert.equal(window.document.body.dataset.theme, "rose");
    assert.equal(view.$("#connection-status").dataset.state, "offline");
    view.$("#start-button").click();
    for (let index = 0; index < 10; index++) {
      const [a, , b] = view.$("#equation").textContent.split(" ");
      view.$("#answer-input").value = String(Number(a) + Number(b));
      view
        .$("#answer-form")
        .dispatchEvent(
          new window.Event("submit", { bubbles: true, cancelable: true }),
        );
      if (index < 9)
        await waitFor(
          () =>
            view.$("#question-number").textContent === "QUESTÃO " + (index + 2),
        );
    }
    await waitFor(() => !window.MenteApp.activeSession());
    assert.equal(view.stored().sessions[0].correct, 10);
    assert.equal(view.stored().sessions[0].answers.length, 10);
    assert.equal(view.$("#summary-accuracy").textContent, "100%");
    view.$('.bottom-nav [data-target="history"]').click();
    assert.equal(view.$("#history-list").children.length, 1);
    view.$('.bottom-nav [data-target="progress"]').click();
    assert.equal(view.$("#total-correct").textContent, "10");
    assert.deepEqual(view.errors, []);
  } finally {
    view.dom.window.close();
  }
});

test("theme, profile, backup import and reopen use the same persisted data", async () => {
  const initial = seed();
  initial.sessions.push({
    id: "before-refactor",
    operation: "add",
    level: "base",
    startedAt: 1700000000000,
    finishedAt: 1700000001000,
    correct: 1,
    wrong: 0,
    answers: [
      { a: 2, b: 3, expected: 5, given: 5, correct: true, elapsedMs: 1000 },
    ],
  });
  const view = await mount(initial);
  let reopened;
  try {
    view.$('.bottom-nav [data-target="settings"]').click();
    view.$("#theme-grid button").click();
    assert.equal(view.stored().profile.theme, "neon");
    view.$("#open-profile").click();
    view.$("#player-name").value = "Novo nome";
    view.$("#save-profile").click();
    assert.equal(view.stored().profile.name, "Novo nome");
    view.$("#back-settings").click();
    view.$("#backup-password").value = "test-password";
    view.$("#export-backup-button").click();
    assert.match(view.$("#backup-payload").value, /^test-encrypted:/);
    view.$("#clear-data-button").click();
    view.$("#clear-data-button").click();
    assert.equal(view.stored().sessions.length, 0);
    view.$("#import-backup-button").click();
    assert.equal(view.stored().sessions[0].id, "before-refactor");
    assert.equal(view.stored().installId, initial.installId);
    reopened = await mount(view.stored());
    assert.deepEqual(reopened.stored(), view.stored());
    assert.equal(reopened.$("#player-name").value, "Novo nome");
    assert.deepEqual(view.errors, []);
    assert.deepEqual(reopened.errors, []);
  } finally {
    view.dom.window.close();
    reopened?.dom.window.close();
  }
});
