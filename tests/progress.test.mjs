import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ACHIEVEMENTS, achievementProgress } from "../shared/achievements.mjs";
import { generateDrill, drillAnswer } from "../shared/drills.mjs";
import { practiceStreak } from "../shared/practice-streak.mjs";
import { createSiteFixture } from "./site-fixture.mjs";

const at = (day) => Date.parse(`${day}T15:00:00Z`);
const medal = (data, id) => data.achievements.find((entry) => entry.id === id);

test("daily progress comes from complete account sessions, not logins, claims or retries", async () => {
  const { sqlite, key, call } = await createSiteFixture();
  try {
    const now = at("2026-09-07");
    const train = async (count, time = now) => {
      const started = await call("/api/achievements/session", { body: { duration: 60 }, now: time });
      const body = { sessionId: started.data.sessionId, answers: Array.from({ length: count }, (_, a) => ({ operation: "add", a, b: 1, given: a + 1 })), current: 999, day: "2026-09-06", userId: key("player-b") };
      assert.equal((await call("/api/achievements/complete", { body, now: time })).status, 200);
      return body;
    };
    assert.equal((await call("/api/account", { now })).status, 200);
    assert.equal((await call("/api/achievements", { now })).data.streak.current, 0);
    await train(9);
    await train(9);
    assert.equal((await call("/api/achievements", { now })).data.streak.current, 0);
    const saved = await train(10);
    await train(10);
    let data = (await call("/api/achievements", { now })).data;
    assert.equal(data.streak.current, 1);
    assert.equal(data.streak.practicedToday, true);
    assert.equal(medal(data, "explorer").progress, 1);
    assert.equal(sqlite.prepare("SELECT operation FROM achievement_training_sessions_v1 WHERE id = ?").get(saved.sessionId).operation, "add");
    // Retrying yesterday's result must not count as practicing today.
    await call("/api/achievements/complete", { body: saved, now: at("2026-09-08") });
    data = (await call("/api/achievements", { now: at("2026-09-08") })).data;
    assert.equal(data.streak.practicedToday, false);
    assert.equal(data.streak.current, 1);
    const other = (await call(`/api/achievements?userId=${key("player-a")}`, { user: "player-b", now })).data;
    assert.equal(other.streak.current, 0);
    assert.equal(other.unlockedCount, 0);
    assert.doesNotMatch(JSON.stringify(data), /h1:|user_id|player-a/);
    assert.equal((await call("/api/achievements", { user: null })).status, 401);
    assert.equal((await call("/api/achievements", { env: {} })).status, 503);

    // Existing ranked and specific sessions participate without a backfill write.
    const rank = await call("/api/ranking/session", { body: { operation: "sub", duration: 60, tier: "advanced" }, now: at("2026-09-08") });
    assert.equal(rank.status, 201);
    assert.equal((await call("/api/ranking/submit", { body: { sessionId: rank.data.sessionId, correct: 10, wrong: 0, bestStreak: 10 }, now: at("2026-09-08") + 60_000 })).status, 201);
    const drill = generateDrill({ operation: "mul", skill: "table", table: 7, min: 1, max: 10, count: 10 });
    await call("/api/drills/complete", { body: { id: crypto.randomUUID(), config: drill.config, answers: drill.questions.map((question) => ({ ...question, given: drillAnswer(question) })) }, now: at("2026-09-10") });
    data = (await call("/api/achievements", { now: at("2026-09-10") })).data;
    assert.equal(data.streak.current, 3);
    assert.equal(data.streak.week[2].state, "protected");
    assert.equal(medal(data, "explorer").unlocked, true);
    for (const day of ["2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"]) await train(10, at(day));
    data = (await call("/api/achievements", { now: at("2026-09-17") })).data;
    assert.equal(data.streak.current, 0);
    assert.equal(data.streak.best, 7);
    assert.equal(medal(data, "seven-practice-days").unlocked, true);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM ranking_attempts_v1").get().n, 1);
  } finally { sqlite.close(); }
});

test("skill runs keep earned medals, respect difficulty and 90%, and use both question counts", async () => {
  const { sqlite, call } = await createSiteFixture();
  try {
    let now = at("2026-09-07");
    const train = async (correct, count = 10, max = 99) => {
      now += 1000;
      const drill = generateDrill({ operation: "sub", skill: "borrow", min: 10, max, count });
      const answers = drill.questions.map((question, index) => ({ ...question, given: drillAnswer(question) + (index < correct ? 0 : 1) }));
      assert.equal((await call("/api/drills/complete", { body: { id: crypto.randomUUID(), config: drill.config, answers }, now })).status, 201);
      return (await call("/api/achievements", { now })).data;
    };
    await train(9);
    await train(9);
    assert.equal(medal(await train(10, 10, 999), "solid-foundation").progress, 2);
    assert.equal(medal(await train(8), "solid-foundation").progress, 2);
    await train(9);
    await train(14, 15);
    assert.equal(medal(await train(9), "solid-foundation").unlocked, true);
    assert.equal(medal(await train(0), "solid-foundation").unlocked, true);
    assert.equal((await call("/api/achievements", { user: "player-b", now })).data.unlockedCount, 0);
  } finally { sqlite.close(); }
});

test("record improvement excludes first attempts, ties, other durations and other ranges", async () => {
  const { sqlite, key, call } = await createSiteFixture();
  try {
    let now = at("2026-09-07");
    const insert = (score, operation = "add", duration = 60) => sqlite.prepare(`INSERT INTO ranking_attempts_v1
      (id, name_key, nickname, operation, duration, score, correct, wrong, best_streak, played_at, user_id)
      VALUES (?, 'player-a', 'player-a', ?, ?, ?, 50, 0, 50, ?, ?)`)
      .run(crypto.randomUUID(), operation, duration, score, now += 1000, key("player-a"));
    insert(100);
    insert(100);
    insert(900, "add", 120);
    insert(1000, "add_1000");
    insert(800, "add", 120);
    assert.equal(medal((await call("/api/achievements", { now })).data, "personal-best").unlocked, false);
    insert(101);
    assert.equal(medal((await call("/api/achievements", { now })).data, "personal-best").unlocked, true);
    for (let i = 0; i < 14; i += 1) insert(0);
    for (let i = 0; i < 50; i += 1) sqlite.prepare("INSERT INTO achievement_reviews_v1 VALUES (?, ?, ?)").run(crypto.randomUUID(), key("player-a"), now);
    const data = (await call("/api/achievements", { now })).data;
    assert.equal(medal(data, "thousand-correct").unlocked, true);
    assert.equal(medal(data, "fifty-reviews").unlocked, true);
    assert.equal(medal(data, "ten-reviews").unlocked, true);
    assert.equal(sqlite.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  } finally { sqlite.close(); }
});

test("all eleven medals and the accessible week calendar render with account-only data", async () => {
  const bundled = await build({ entryPoints: [new URL("../app/achievements-card.jsx", import.meta.url).pathname], bundle: true, write: false, format: "cjs", platform: "node", jsx: "automatic", external: ["react", "react/jsx-runtime"],
    plugins: [{ name: "link", setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: 'import React from "react"; export default function Link(props){return React.createElement("a", props, props.children)}' }));
    } }] });
  const module = { exports: {} };
  new Function("require", "exports", "module", bundled.outputFiles[0].text)(createRequire(import.meta.url), module.exports, module);
  const data = { achievements: achievementProgress({}), unlockedCount: 0, streak: practiceStreak(["2026-09-07"], at("2026-09-09")) };
  const html = renderToStaticMarkup(React.createElement(module.exports.default, { viewer: { account: { nickname: "example", createdAt: 1 } }, accountState: "ready", progress: { data, state: "ready", announcement: "", load() {} } }));
  assert.equal(ACHIEVEMENTS.length, 11);
  assert.match(html, /11 desbloqueadas/);
  assert.match(html, /Descanso protegido já utilizado/);
  assert.match(html, /aria-current="date"/);
  assert.match(html, /Horário de Brasília/);
  assert.equal((html.match(/class="achievement-medal /g) ?? []).length, 11);
  const source = await readFile(new URL("../app/use-achievement-data.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /viewer\.account\?\.userId/);
});
