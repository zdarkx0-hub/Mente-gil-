import assert from "node:assert/strict";
import test from "node:test";
import { achievementProgress } from "../shared/achievements.mjs";
import { drillAnswer, generateDrill } from "../shared/drills.mjs";
import { createSiteFixture } from "./site-fixture.mjs";

test("achievement thresholds require real progress and a nonempty perfect session", () => {
  assert.equal(achievementProgress({}).filter((item) => item.unlocked).length, 0);
  const near = achievementProgress({ sessions: 1, totalCorrect: 99, bestStreak: 9, perfectCorrect: 9, reviewCorrect: 9 });
  assert.deepEqual(near.filter((item) => item.unlocked).map((item) => item.id), ["first-session"]);
  const complete = achievementProgress({ sessions: 8, totalCorrect: 1000, bestStreak: 30, perfectCorrect: 30, reviewCorrect: 50, bestPracticeDays: 7, operationsExplored: 3, bestSkillRun: 3, recordImprovements: 1 });
  assert.ok(complete.every((item) => item.unlocked && item.progress === item.target));
});

test("private persisted progress, full ranking history, training retries and review receipts", async () => {
  const { sqlite, key, call } = await createSiteFixture();
  try {
    assert.equal((await call("/api/achievements", { user: null })).status, 401);
    assert.equal((await call("/api/achievements", { user: "unregistered" })).status, 403);
    assert.equal((await call("/api/achievements", { env: {} })).status, 503);
    assert.equal((await call("/api/achievements/session", { body: { duration: 60 }, origin: "https://other.invalid" })).status, 403);
    assert.equal((await call("/api/achievements/session", { body: null })).status, 400);
    assert.equal((await call("/api/achievements/session", { body: { duration: 15 } })).status, 400);

    const insertAttempt = sqlite.prepare(`INSERT INTO ranking_attempts_v1
      (id, name_key, nickname, operation, duration, score, correct, wrong, best_streak, played_at, user_id)
      VALUES (?, 'player-a', 'player-a', 'add', 60, 100, ?, ?, ?, 1, ?)`);
    for (let index = 0; index < 120; index += 1) insertAttempt.run("historical-" + index, 1, 1, 1, key("player-a"));
    let result = await call("/api/achievements");
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.achievements.filter((item) => item.unlocked).map((item) => item.id), ["first-session", "hundred-correct"]);
    assert.equal((await call("/api/achievements?userId=" + key("player-a"), { user: "player-b" })).data.unlockedCount, 0);
    assert.doesNotMatch(JSON.stringify(result.data), /h1:|player-a|user_id/);

    const started = await call("/api/achievements/session", { body: { duration: 60 } });
    assert.equal(started.status, 201);
    const sessionId = started.data.sessionId;
    const answers = Array.from({ length: 10 }, (_, a) => ({ operation: "add", a, b: 1, given: a + 1 }));
    assert.equal((await call("/api/achievements/complete", { user: "player-b", body: { sessionId, answers } })).status, 404);
    assert.equal((await call("/api/achievements/complete", { body: { sessionId, answers: [] } })).status, 400);
    for (let retry = 0; retry < 2; retry += 1) {
      assert.equal((await call("/api/achievements/complete", { body: { sessionId, answers, correct: 9000, bestStreak: 9000 } })).status, 200);
    }
    assert.equal(sqlite.prepare("SELECT SUM(correct) AS total FROM achievement_training_sessions_v1").get().total, 10);
    assert.equal((await call("/api/achievements")).data.unlockedCount, 4);

    const offlineNow = 1_800_000_000_000;
    const offlineSessionId = crypto.randomUUID();
    const offlineAnswers = Array.from({ length: 10 }, (_, a) => ({
      operation: "add", a, b: 2, given: a === 9 ? 0 : a + 2, level: 0
    }));
    for (let retry = 0; retry < 2; retry += 1) {
      const offlineSaved = await call("/api/achievements/complete", {
        now: offlineNow,
        body: {
          sessionId: offlineSessionId,
          offline: true,
          duration: 60,
          startedAt: offlineNow - 60_000,
          answers: offlineAnswers
        }
      });
      assert.equal(offlineSaved.status, 200);
    }
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM achievement_training_sessions_v1 WHERE id = ?").get(offlineSessionId).n, 1);
    assert.equal(sqlite.prepare("SELECT SUM(wrong_count) AS n FROM practice_errors_v1 WHERE user_id = ?").get(key("player-a")).n, 1);
    assert.equal((await call("/api/achievements/complete", {
      now: offlineNow,
      body: { sessionId: crypto.randomUUID(), offline: true, duration: 15, startedAt: offlineNow - 1_000, answers: offlineAnswers }
    })).status, 400);

    const mixedId = (await call("/api/achievements/session", { body: { duration: 300 } })).data.sessionId;
    await call("/api/achievements/complete", { body: { sessionId: mixedId, answers: [
      { operation: "sub", a: 12, b: 3, given: 9 },
      { operation: "mul", a: 3, b: 3, given: 8.5 },
      { operation: "mul", a: 4, b: 5, given: 20 }
    ] } });
    assert.deepEqual({ ...sqlite.prepare("SELECT correct, wrong, best_streak FROM achievement_training_sessions_v1 WHERE id = ?").get(mixedId) }, { correct: 2, wrong: 1, best_streak: 1 });
    sqlite.prepare("DELETE FROM practice_errors_v1 WHERE user_id = ?").run(key("player-a"));

    for (let index = 0; index < 10; index += 1) {
      const id = "error-" + index;
      sqlite.prepare("INSERT INTO practice_errors_v1 VALUES (?, ?, 'add', 0, ?, 1, ?, 0, 1, 1)").run(id, key("player-a"), index, index + 1);
      assert.equal((await call("/api/review/errors/answer", { user: "player-b", body: { id, given: index + 1 } })).status, 404);
      assert.equal((await call("/api/review/errors/answer", { body: { id, given: -1 } })).data.correct, false);
      for (let retry = 0; retry < 2; retry += 1) {
        assert.equal((await call("/api/review/errors/answer", { body: { id, given: index + 1 } })).data.correct, true);
      }
    }
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM achievement_reviews_v1").get().n, 10);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM practice_errors_v1").get().n, 0);
    assert.equal((await call("/api/achievements")).data.unlockedCount, 5);
    assert.equal((await call("/api/achievements", { user: "player-b" })).data.unlockedCount, 0);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM ranking_attempts_v1").get().n, 120);

    // Specific drills are private, complete-only, idempotent and independent of ranking.
    assert.equal((await call("/api/drills", { user: null })).status, 401);
    assert.equal((await call("/api/drills", { user: "unregistered" })).status, 403);
    assert.equal((await call("/api/drills", { env: {} })).status, 503);
    assert.equal((await call("/api/drills/complete", { body: null })).status, 400);
    assert.equal((await call("/api/drills/complete", { body: {}, origin: "https://other.invalid" })).status, 403);
    const drill = generateDrill({ operation: "mul", skill: "table", table: 7, min: 1, max: 10, count: 15 });
    const drillPayload = {
      id: crypto.randomUUID(), config: drill.config,
      answers: drill.questions.map((question, index) => ({ ...question, given: drillAnswer(question) + (index >= 10 ? 1 : 0) }))
    };
    for (const changed of [
      { id: "invalid" }, { answers: drillPayload.answers.slice(1) },
      { config: { ...drill.config, count: 20 } },
      { answers: drillPayload.answers.map((item) => ({ ...item, a: 8 })) },
      { answers: drillPayload.answers.map((item) => ({ ...item, given: null })) }
    ]) assert.equal((await call("/api/drills/complete", { user: "player-b", body: { ...drillPayload, ...changed } })).status, 400);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM specific_drill_sessions_v1").get().n, 0);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM practice_errors_v1").get().n, 0);
    assert.equal((await call("/api/drills/complete", { user: "player-b", body: { ...drillPayload, correct: 1000, userId: key("player-a") } })).status, 201);
    assert.equal((await call("/api/drills/complete", { user: "player-b", body: drillPayload })).status, 200);
    assert.equal((await call("/api/drills/complete", { user: "player-a", body: drillPayload })).status, 404);
    assert.equal(sqlite.prepare("SELECT SUM(wrong_count) AS n FROM practice_errors_v1 WHERE user_id = ?").get(key("player-b")).n, 5);
    assert.equal((await call("/api/drills")).data.sessions.length, 0);
    const drillHistory = (await call("/api/drills?userId=" + key("player-a"), { user: "player-b" })).data.sessions;
    assert.equal(drillHistory.length, 1);
    assert.equal(drillHistory[0].correct, 10);
    assert.equal(drillHistory[0].wrong, 5);
    assert.equal(drillHistory[0].accuracy, 67);
    assert.equal(drillHistory[0].config.count, 15);
    assert.doesNotMatch(JSON.stringify(drillHistory), /h1:|player-b|user_id/);
    assert.deepEqual((await call("/api/achievements", { user: "player-b" })).data.achievements.filter((item) => item.unlocked).map((item) => item.id), ["first-session", "ten-streak"]);
    assert.equal((await call("/api/review/errors", { user: "player-b" })).data.errors.length, 5);
    assert.equal((await call("/api/review/errors")).data.errors.length, 0);

    const perfect = generateDrill({ operation: "sub", skill: "borrow", min: 10, max: 99, count: 10 });
    const perfectPayload = { id: crypto.randomUUID(), config: perfect.config, answers: perfect.questions.map((question) => ({ ...question, given: drillAnswer(question) })) };
    assert.equal((await call("/api/drills/complete", { user: "player-b", body: perfectPayload })).status, 201);
    assert.equal((await call("/api/achievements", { user: "player-b" })).data.achievements.find((item) => item.id === "perfect-session").unlocked, true);

    // Simulated storage failure rolls back mistakes as well as history; retry is safe.
    const retryPayload = { ...drillPayload, id: crypto.randomUUID() };
    sqlite.exec("CREATE TRIGGER test_drill_failure BEFORE INSERT ON specific_drill_sessions_v1 BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END");
    assert.equal((await call("/api/drills/complete", { user: "player-b", body: retryPayload })).status, 500);
    assert.equal(sqlite.prepare("SELECT SUM(wrong_count) AS n FROM practice_errors_v1 WHERE user_id = ?").get(key("player-b")).n, 5);
    sqlite.exec("DROP TRIGGER test_drill_failure");
    assert.equal((await call("/api/drills/complete", { user: "player-b", body: retryPayload })).status, 201);
    assert.equal(sqlite.prepare("SELECT SUM(wrong_count) AS n FROM practice_errors_v1 WHERE user_id = ?").get(key("player-b")).n, 10);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM ranking_attempts_v1").get().n, 120);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM ranking_entries_v2").get().n, 0);
    const plan = sqlite.prepare("EXPLAIN QUERY PLAN SELECT id FROM specific_drill_sessions_v1 WHERE user_id = ? ORDER BY completed_at DESC, id DESC LIMIT 10").all(key("player-b"));
    assert.match(plan.map((item) => item.detail).join(" "), /idx_specific_drill_sessions_user_completed/);
    assert.equal(sqlite.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  } finally { sqlite.close(); }
});
