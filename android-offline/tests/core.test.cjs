const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../app/src/main/assets/www/core.js");

test("soma e subtração respeitam o limite escolhido", () => {
  for (const level of ["base", "medium", "advanced"]) {
    for (const operation of ["add", "sub"]) {
      for (let index = 0; index < 100; index += 1) {
        const question = core.buildQuestion(level, operation);
        const limit = level === "base" ? 20 : level === "medium" ? 100 : 1000;
        assert.ok(question.a >= 0 && question.a <= limit);
        assert.ok(question.b >= 0 && question.b <= limit);
        assert.ok(question.answer >= 0 && question.answer <= limit);
      }
    }
  }
});

test("multiplicação produz resposta correta", () => {
  for (const level of ["base", "medium", "advanced"]) {
    const question = core.buildQuestion(level, "mul", () => 0.5);
    assert.equal(question.answer, question.a * question.b);
  }
});

test("precisão trata sessão vazia e arredonda", () => {
  assert.equal(core.accuracy(0, 0), 0);
  assert.equal(core.accuracy(9, 1), 90);
  assert.equal(core.accuracy(2, 1), 67);
});

test("foguinho conta apenas sessões com dez respostas", () => {
  const atNoon = (day) => Date.parse(day + "T15:00:00Z");
  const sessions = [
    { finishedAt: atNoon("2026-09-05"), answers: Array(10).fill({ correct: true }) },
    { finishedAt: atNoon("2026-09-06"), answers: Array(9).fill({ correct: true }) },
    { finishedAt: atNoon("2026-09-06"), answers: Array(10).fill({ correct: true }) },
    { finishedAt: atNoon("2026-09-07"), answers: Array(15).fill({ correct: true }) }
  ];
  const result = core.practiceStreak(sessions);
  assert.equal(result.best, 3);
});

test("resumo preserva maior sequência de acertos", () => {
  const result = core.summarize([
    { correct: 3, wrong: 1, answers: [{ correct: true }, { correct: true }, { correct: false }, { correct: true }] },
    { correct: 4, wrong: 0, answers: Array(4).fill({ correct: true }) }
  ]);
  assert.equal(result.correct, 7);
  assert.equal(result.wrong, 1);
  assert.equal(result.longest, 4);
  assert.equal(result.accuracy, 88);
});
