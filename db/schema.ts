// Additive achievement schema. Production applies the matching Drizzle migration,
// never runtime CREATE/ALTER statements. Existing ranking schemas are unchanged.
export const achievementSchema = `
CREATE TABLE achievement_training_sessions_v1 (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  duration INTEGER NOT NULL CHECK (duration IN (60, 120, 300)),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  correct INTEGER NOT NULL DEFAULT 0 CHECK (correct >= 0),
  wrong INTEGER NOT NULL DEFAULT 0 CHECK (wrong >= 0),
  best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0 AND best_streak <= correct),
  operation TEXT NOT NULL DEFAULT 'mix' CHECK (operation IN ('add', 'sub', 'mul', 'mix'))
);
CREATE INDEX idx_achievement_training_sessions_user
  ON achievement_training_sessions_v1 (user_id, completed_at);
CREATE TABLE achievement_reviews_v1 (
  error_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  resolved_at INTEGER NOT NULL
);
CREATE INDEX idx_achievement_reviews_user
  ON achievement_reviews_v1 (user_id);
`;

// Independent, untimed sessions; never stored as ranked or timed attempts.
export const specificDrillSchema = `
CREATE TABLE specific_drill_sessions_v1 (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  config_json TEXT NOT NULL,
  question_count INTEGER NOT NULL CHECK (question_count IN (10, 15)),
  correct INTEGER NOT NULL CHECK (correct >= 0),
  wrong INTEGER NOT NULL CHECK (wrong >= 0),
  best_streak INTEGER NOT NULL CHECK (best_streak >= 0 AND best_streak <= correct),
  completed_at INTEGER NOT NULL,
  CHECK (correct + wrong = question_count)
);
CREATE INDEX idx_specific_drill_sessions_user_completed
  ON specific_drill_sessions_v1 (user_id, completed_at DESC, id DESC);
`;
