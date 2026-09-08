(function attachCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MenteCore = api;
})(typeof window !== "undefined" ? window : null, function createCore() {
  const OPERATIONS = ["add", "sub", "mul"];

  function randomInt(min, max, random = Math.random) {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  function buildQuestion(level, operation, random = Math.random) {
    const selectedOperation = OPERATIONS.includes(operation) ? operation : "add";
    const ranges = {
      base: { add: 20, sub: 20, mul: 5 },
      medium: { add: 100, sub: 100, mul: 12 },
      advanced: { add: 1000, sub: 1000, mul: 32 }
    };
    const selected = ranges[level] || ranges.base;
    let a;
    let b;
    let answer;

    if (selectedOperation === "add") {
      answer = randomInt(Math.max(4, Math.floor(selected.add * 0.35)), selected.add, random);
      a = randomInt(1, answer - 1, random);
      b = answer - a;
    } else if (selectedOperation === "sub") {
      a = randomInt(Math.max(5, Math.floor(selected.sub * 0.35)), selected.sub, random);
      b = randomInt(1, a, random);
      answer = a - b;
    } else {
      a = randomInt(level === "advanced" ? 6 : 1, selected.mul, random);
      b = randomInt(1, level === "advanced" ? 25 : selected.mul, random);
      answer = a * b;
    }

    return {
      a,
      b,
      answer,
      operation: selectedOperation,
      symbol: selectedOperation === "add" ? "+" : selectedOperation === "sub" ? "−" : "×"
    };
  }

  function accuracy(correct, wrong) {
    const total = correct + wrong;
    return total ? Math.round((correct / total) * 100) : 0;
  }

  function brasiliaDay(timestamp) {
    const time = Number(timestamp);
    if (!Number.isFinite(time)) return "";
    return new Date(time - (3 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  }

  function dayNumber(day) {
    return Math.floor(Date.parse(day + "T00:00:00Z") / 86400000);
  }

  function practiceStreak(sessions) {
    const qualifying = sessions
      .filter((session) => Array.isArray(session.answers) && session.answers.length >= 10)
      .map((session) => brasiliaDay(session.finishedAt || session.startedAt))
      .filter(Boolean);
    const days = [...new Set(qualifying)].sort();
    let current = 0;
    let best = 0;
    let previous = null;

    days.forEach((day) => {
      const numeric = dayNumber(day);
      current = previous !== null && numeric === previous + 1 ? current + 1 : 1;
      best = Math.max(best, current);
      previous = numeric;
    });

    const today = brasiliaDay(Date.now());
    const last = days[days.length - 1];
    const active = last && dayNumber(today) - dayNumber(last) <= 1 ? current : 0;
    return { current: active, best, practicedToday: last === today };
  }

  function longestAnswerStreak(answers) {
    let current = 0;
    let best = 0;
    answers.forEach((answer) => {
      current = answer.correct ? current + 1 : 0;
      best = Math.max(best, current);
    });
    return best;
  }

  function summarize(sessions) {
    const totals = sessions.reduce((result, session) => {
      result.correct += Number(session.correct) || 0;
      result.wrong += Number(session.wrong) || 0;
      result.longest = Math.max(result.longest, longestAnswerStreak(session.answers || []));
      return result;
    }, { correct: 0, wrong: 0, longest: 0 });
    const streak = practiceStreak(sessions);
    return { ...totals, accuracy: accuracy(totals.correct, totals.wrong), streak };
  }

  return { OPERATIONS, randomInt, buildQuestion, accuracy, brasiliaDay, practiceStreak, longestAnswerStreak, summarize };
});
