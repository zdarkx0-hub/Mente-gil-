import { achievementProgress } from "../shared/achievements.mjs";
import { MIN_DAILY_ANSWERS, PRACTICE_UTC_OFFSET_MS, practiceStreak } from "../shared/practice-streak.mjs";

// Read the complete account history. No public nickname or browser-supplied user
// identifier is used here; each placeholder receives the authenticated HMAC key.
const SESSION_HISTORY = `
  SELECT id, correct, wrong, best_streak, played_at AS completed_at,
    REPLACE(operation, '_1000', '') AS operation
  FROM ranking_attempts_v1 WHERE user_id = ? AND correct + wrong > 0
  UNION ALL
  SELECT id, correct, wrong, best_streak, completed_at, operation
  FROM achievement_training_sessions_v1
    WHERE user_id = ? AND completed_at IS NOT NULL AND correct + wrong > 0
  UNION ALL
  SELECT id, correct, wrong, best_streak, completed_at,
    json_extract(config_json, '$.operation') AS operation
  FROM specific_drill_sessions_v1 WHERE user_id = ?
`;

async function loadTotals(db: D1Database, userId: string) {
  return db.prepare(`WITH sessions AS (${SESSION_HISTORY})
    SELECT COUNT(*) AS sessions, COALESCE(SUM(correct), 0) AS totalCorrect,
      COALESCE(MAX(best_streak), 0) AS bestStreak,
      COALESCE(MAX(CASE WHEN wrong = 0 THEN correct ELSE 0 END), 0) AS perfectCorrect,
      COUNT(DISTINCT CASE WHEN correct + wrong >= ? AND operation IN ('add', 'sub', 'mul') THEN operation END) AS operationsExplored,
      (SELECT COUNT(*) FROM achievement_reviews_v1 WHERE user_id = ?) AS reviewCorrect
    FROM sessions`).bind(userId, userId, userId, MIN_DAILY_ANSWERS, userId).first<Record<string, number>>();
}

async function loadPracticeDays(db: D1Database, userId: string) {
  const rows = await db.prepare(`WITH sessions AS (${SESSION_HISTORY})
    SELECT DISTINCT date(completed_at / 1000, 'unixepoch', ?) AS day
    FROM sessions WHERE correct + wrong >= ? ORDER BY day`)
    .bind(userId, userId, userId, `${PRACTICE_UTC_OFFSET_MS / 1000} seconds`, MIN_DAILY_ANSWERS)
    .all<{ day: string }>();
  return (rows.results ?? []).map((row) => row.day).filter(Boolean);
}

async function loadBestSkillRun(db: D1Database, userId: string) {
  // Changing difficulty or a multiplication table starts a different skill run.
  // Count 10- and 15-question sessions together, and keep the best historical run
  // so a later mistake cannot take away a medal that has already been earned.
  const row = await db.prepare(`
    WITH attempts AS (
      SELECT id, completed_at, correct * 100 >= question_count * 90 AS passed,
        json_array(json_extract(config_json, '$.operation'), json_extract(config_json, '$.skill'),
          json_extract(config_json, '$.min'), json_extract(config_json, '$.max'),
          json_extract(config_json, '$.table')) AS skill
      FROM specific_drill_sessions_v1 WHERE user_id = ?
    ), grouped AS (
      SELECT skill, passed, SUM(CASE WHEN passed THEN 0 ELSE 1 END)
        OVER (PARTITION BY skill ORDER BY completed_at, id ROWS UNBOUNDED PRECEDING) AS run
      FROM attempts
    ), runs AS (
      SELECT COUNT(*) AS length FROM grouped WHERE passed GROUP BY skill, run
    ) SELECT COALESCE(MAX(length), 0) AS bestSkillRun FROM runs
  `).bind(userId).first<{ bestSkillRun: number }>();
  return row?.bestSkillRun ?? 0;
}

async function loadRecordImprovements(db: D1Database, userId: string) {
  const row = await db.prepare(`
    WITH previous_records AS (
      SELECT score, MAX(score) OVER (
        PARTITION BY operation, duration ORDER BY played_at
        RANGE BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS previousBest
      FROM ranking_attempts_v1 WHERE user_id = ? AND correct + wrong > 0
    ) SELECT COUNT(*) AS improvements FROM previous_records
      WHERE previousBest IS NOT NULL AND score > previousBest
  `).bind(userId).first<{ improvements: number }>();
  return row?.improvements ?? 0;
}

export async function loadAchievements(db: D1Database, userId: string, now = Date.now()) {
  const [totals, days, bestSkillRun, recordImprovements] = await Promise.all([
    loadTotals(db, userId), loadPracticeDays(db, userId),
    loadBestSkillRun(db, userId), loadRecordImprovements(db, userId)
  ]);
  const streak = practiceStreak(days, now);
  const achievements = achievementProgress({ ...totals, bestSkillRun, recordImprovements, bestPracticeDays: streak.best });
  return { achievements, streak, unlockedCount: achievements.filter((item) => item.unlocked).length };
}
