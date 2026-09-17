const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture, element, deferred } = require("./feature-fixture.cjs");

test("an old ranking response cannot overwrite the newly selected category", async () => {
  const old = deferred(),
    current = deferred();
  let calls = 0;
  const view = fixture("ranking", {
    rankingRequest: () => (++calls === 1 ? old : current).promise,
  });
  const first = view.api.loadRanking(),
    second = view.api.loadRanking();
  current.resolve({
    entries: [{ nickname: "Current", position: 1, score: 10, medals: [] }],
  });
  await second;
  const currentCard = view.$("#ranking-list").childNodes[0];
  old.resolve({ entries: [] });
  await first;
  assert.equal(view.$("#ranking-list").childNodes[0], currentCard);
});

test("a ranked start keeps its requested category while selectors change", async () => {
  const request = deferred();
  let started;
  const view = fixture("ranking", {
    rankingRequest: (method) =>
      method === "GET" ? Promise.resolve({ entries: [] }) : request.promise,
    training: {
      active: () => false,
      startSession: (options) => {
        started = options;
      },
    },
  });
  view.store.connect({ id: "account-a", publicId: "MA-A", name: "Tester" });
  const button = element({ value: "mul" });
  view.groups.set("#rank-operation-options button", [button]);
  view.api.bindEvents();
  const starting = view.$("#rank-start-button").fire("click");
  button.fire("click");
  request.resolve({ sessionId: "rank-1", question: { a: 2, b: 3 } });
  await starting;
  assert.equal(started.operation, "add");
  assert.equal(started.goal, 60);
});

for (const failure of [false, true]) {
  test(`a cancelled ranked answer cannot ${failure ? "unlock" : "score in"} the next training`, async () => {
    const request = deferred();
    const view = fixture("training", { rankingRequest: () => request.promise });
    view.api.bindEvents();
    view.api.startSession({
      operation: "add",
      level: "base",
      mode: "time",
      goal: 60,
      ranked: true,
      rankSessionId: "old",
      rankQuestion: { id: "q", a: 2, b: 3, symbol: "+" },
    });
    view.$("#answer-input").value = "5";
    const answering = view.$("#answer-form").fire("submit");
    view.$("#stop-button").fire("click");
    view.api.startSession({
      operation: "sub",
      level: "base",
      mode: "count",
      goal: 10,
    });
    view.$("#answer-input").value = "12345";
    if (failure) request.reject(new Error("old network failure"));
    else
      request.resolve({
        correct: true,
        correctCount: 1,
        wrongCount: 0,
        expectedAnswer: 5,
      });
    await answering;
    assert.equal(view.$("#correct-count").textContent, "0");
    assert.equal(view.$("#answer-input").value, "12345");
    assert.equal(view.store.snapshot().sessions.length, 0);
  });
}

test("offline training completes, saves answers and stops its timers", async () => {
  const view = fixture("training", {
    rankingRequest: () =>
      assert.fail("offline training must not request ranking"),
  });
  view.api.bindEvents();
  view.api.startSession({
    operation: "add",
    level: "base",
    mode: "count",
    goal: 1,
  });
  const [a, , b] = view.$("#equation").textContent.split(" ");
  view.$("#answer-input").value = String(Number(a) + Number(b));
  await view.$("#answer-form").fire("submit");
  [...view.timers.values()].at(-1)();
  assert.equal(view.api.active(), false);
  assert.equal(view.saved().sessions[0].correct, 1);
  assert.equal(view.saved().sessions[0].answers.length, 1);
  assert.equal(view.timers.size, 0);
});

test("pending medal synchronization cannot modify a newly connected account", async () => {
  const request = deferred();
  const view = fixture("customization", {
    rankingRequest: () => request.promise,
  });
  const loading = view.api.loadRankingMedals();
  view.store.connect({ id: "account-a", publicId: "MA-A", name: "Tester" });
  request.resolve({ eligible: ["ranked-first"], selected: ["ranked-first"] });
  await loading;
  assert.deepEqual(view.store.snapshot().rankingEligibleMedals, []);
});
