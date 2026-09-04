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
--> statement-breakpoint
CREATE INDEX idx_specific_drill_sessions_user_completed
  ON specific_drill_sessions_v1 (user_id, completed_at DESC, id DESC);
--> statement-breakpoint
PRAGMA optimize;
