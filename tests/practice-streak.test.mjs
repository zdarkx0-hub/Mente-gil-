import assert from "node:assert/strict";
import test from "node:test";
import { practiceDay, practiceStreak } from "../shared/practice-streak.mjs";

const noon = (day) => Date.parse(`${day}T15:00:00Z`);

test("Brasília midnight, not UTC midnight or the client date, separates days", () => {
  assert.equal(practiceDay(Date.parse("2026-09-08T02:59:59.999Z")), "2026-09-07");
  assert.equal(practiceDay(Date.parse("2026-09-08T03:00:00Z")), "2026-09-08");
  const result = practiceStreak(["2026-09-07", "2026-09-07", "2099-01-01"], noon("2026-09-07"));
  assert.equal(result.current, 1);
  assert.equal(result.best, 1);
  assert.equal(result.practicedToday, true);
  assert.equal(result.nextDayAt, Date.parse("2026-09-08T03:00:00Z"));
  assert.equal(result.week[0].label, "Seg");
  assert.equal(result.week[0].state, "practiced");
  assert.equal(result.week.filter((day) => day.state === "practiced").length, 1);
});

test("no practice gives no fire; today does not consume tomorrow's automatic rest", () => {
  const empty = practiceStreak([], noon("2026-09-07"));
  assert.equal(empty.current, 0);
  assert.equal(empty.best, 0);
  assert.equal(empty.lastPracticeDay, null);
  const pending = practiceStreak(["2026-09-07"], noon("2026-09-08"));
  assert.equal(pending.current, 1);
  assert.equal(pending.practicedToday, false);
  assert.equal(pending.restAvailable, true);
  const rested = practiceStreak(["2026-09-07"], noon("2026-09-09"));
  assert.equal(rested.current, 1);
  assert.equal(rested.restAvailable, false);
  assert.equal(rested.week[1].state, "protected");
  const broken = practiceStreak(["2026-09-07"], noon("2026-09-10"));
  assert.equal(broken.current, 0);
  assert.equal(broken.best, 1);
});

test("seven real training days unlock a week; protected days never increase the count", () => {
  const days = ["2026-09-07", "2026-09-08", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"];
  const achieved = practiceStreak(days, noon("2026-09-14"));
  assert.equal(achieved.current, 7);
  assert.equal(achieved.best, 7);
  assert.equal(achieved.restAvailable, true);
  const later = practiceStreak(days, noon("2026-09-17"));
  assert.equal(later.current, 0);
  assert.equal(later.best, 7);
  assert.equal(later.week[1].state, "protected");
  assert.equal(later.week[2].state, "missed");
});

test("calendar weeks allow one rest each, including Sunday/Monday across the boundary", () => {
  const boundary = practiceStreak(["2026-09-12", "2026-09-15"], noon("2026-09-15"));
  assert.equal(boundary.current, 2);
  assert.equal(boundary.restAvailable, false);
  assert.equal(boundary.week[0].state, "protected");
  const sameWeek = practiceStreak(["2026-09-07", "2026-09-11"], noon("2026-09-11"));
  assert.equal(sameWeek.current, 1);
  assert.equal(sameWeek.restAvailable, false); // Breaking the streak doesn't grant another rest.
  assert.equal(practiceStreak(["2000-01-01"], noon("2026-09-07")).current, 0);
});

test("day order, duplicates, month ends and leap days don't change the historical record", () => {
  const days = ["2024-02-28", "2024-02-29", "2024-03-01", "2024-03-03"];
  assert.equal(practiceStreak(days, noon("2024-03-03")).best, 4);
  assert.deepEqual(practiceStreak([...days].reverse().concat(days), noon("2024-03-03")), practiceStreak(days, noon("2024-03-03")));
  assert.equal(practiceStreak(days, noon("2026-09-07")).best, 4);
});
