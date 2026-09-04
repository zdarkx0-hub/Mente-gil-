import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { DRILL_SKILLS, drillConfig, drillAnswer, generateDrill, hasBorrow, hasCarry, summarizeDrill } from "../shared/drills.mjs";

function seededRandom(seed = 12345) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
const digitSum = (value) => [...String(value)].reduce((sum, digit) => sum + Number(digit), 0);

test("carry and borrowing include hundreds, chains, and 1000", () => {
  assert.equal(hasCarry(27, 18), true);
  assert.equal(hasCarry(23, 14), false);
  assert.equal(hasCarry(400, 600), true);
  assert.equal(hasBorrow(74, 65), true);
  assert.equal(hasBorrow(86, 42), false);
  assert.equal(hasBorrow(1000, 1), true);
  const random = seededRandom();
  for (let i = 0; i < 10_000; i += 1) {
    const a = Math.floor(random() * 1001);
    const b = Math.floor(random() * 1001);
    assert.equal(hasCarry(a, b), digitSum(a + b) < digitSum(a) + digitSum(b));
    if (a >= b) assert.equal(hasBorrow(a, b), digitSum(a - b) > digitSum(a) - digitSum(b));
  }
});

test("every skill generates exactly 10 or 15 matching questions without adaptation", () => {
  const random = seededRandom();
  for (const [operation, skills] of Object.entries(DRILL_SKILLS)) {
    for (const { value: skill } of skills) {
      for (const count of [10, 15]) {
        for (const [min, max] of [[0, 10], [10, 99], [100, 999], [250, 1000]]) {
          const { config, questions } = generateDrill({ operation, skill, count, min, max, table: 7 }, random);
          assert.equal(questions.length, count);
          for (const question of questions) {
            assert.equal(question.operation, operation);
            assert.ok(question.b >= min && question.b <= max);
            if (operation === "mul") assert.equal(question.a, 7);
            else {
              assert.ok(question.a >= min && question.a <= max);
              if (operation === "add") assert.equal(digitSum(question.a + question.b) < digitSum(question.a) + digitSum(question.b), skill === "carry");
              else {
                assert.ok(question.a >= question.b);
                assert.equal(digitSum(question.a - question.b) > digitSum(question.a) - digitSum(question.b), skill === "borrow");
              }
            }
          }
          const answers = questions.map((question) => ({ ...question, given: drillAnswer(question) }));
          assert.deepEqual(summarizeDrill(config, answers), { config, correct: count, wrong: 0, bestStreak: count, accuracy: 100 });
          assert.throws(() => summarizeDrill(config, answers.slice(1)), /Conclua/);
          assert.throws(() => summarizeDrill(config, [...answers, answers[0]]), /Conclua/);
        }
      }
    }
  }
});

test("narrow ranges repeat transparently and impossible skills never silently switch", () => {
  const config = { operation: "mul", skill: "table", count: 15, min: 1, max: 10, table: 7 };
  const session = generateDrill(config, seededRandom());
  assert.equal(session.repeats, true);
  assert.equal(session.questions.length, 15);
  assert.equal(new Set(session.questions.slice(0, 10).map((item) => item.b)).size, 10);
  assert.notEqual(session.questions[9].b, session.questions[10].b);
  assert.equal(generateDrill({ ...config, count: 10 }).repeats, false);
  for (const changed of [{ count: 20 }, { count: "10" }, { min: -1 }, { min: 11, max: 10 }, { max: 1001 }, { table: 0 }, { skill: "borrow" }]) {
    assert.throws(() => drillConfig({ ...config, ...changed }));
  }
  assert.throws(() => generateDrill({ ...config, operation: "sub", skill: "borrow", min: 1000, max: 1000 }), /Não existem contas/);
  assert.throws(() => generateDrill({ ...config, operation: "add", skill: "carry", min: 0, max: 4 }), /Não existem contas/);
  assert.equal(generateDrill({ ...config, operation: "sub", skill: "no-borrow", min: 1000, max: 1000 }).questions.length, 15);
  const answers = session.questions.map((question, index) => ({ ...question, given: drillAnswer(question) + (index === 7 ? 1 : 0) }));
  const summary = summarizeDrill(config, answers);
  assert.equal(summary.correct, 14);
  assert.equal(summary.wrong, 1);
  assert.equal(summary.bestStreak, 7);
  assert.equal(summary.accuracy, 93);
});

test("setup renders accessible 10/15 choices, defaults to 10 and links to existing navigation", async () => {
  const bundled = await build({
    entryPoints: [new URL("../app/specific-training.jsx", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", external: ["react", "react/jsx-runtime"]
  });
  const { createRequire } = await import("node:module");
  const module = { exports: {} };
  new Function("require", "exports", "module", bundled.outputFiles[0].text)(createRequire(import.meta.url), module.exports, module);
  const html = renderToStaticMarkup(React.createElement(module.exports.default, {
    viewer: { authenticated: false, account: null }, accountState: "ready", otherSessionActive: false,
    onBusyChange() {}, onSaved() {}, onFeedback() {}
  }));
  assert.match(html, /Começar 10 questões/);
  assert.equal((html.match(/name="drill-count"/g) ?? []).length, 2);
  assert.match(html, /<strong>10<\/strong>/);
  assert.match(html, /<strong>15<\/strong>/);
  assert.match(html, /Sem cronômetro/);
  assert.doesNotMatch(html, /20 questões/);
  const source = await readFile(new URL("../app/study-app.jsx", import.meta.url), "utf8");
  assert.match(source, /href="\/treinar\/especificos"/);
});
