CREATE TABLE achievement_training_sessions_v1 (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  duration INTEGER NOT NULL CHECK (duration IN (60, 120, 300)),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  correct INTEGER NOT NULL DEFAULT 0 CHECK (correct >= 0),
  wrong INTEGER NOT NULL DEFAULT 0 CHECK (wrong >= 0),
  best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0 AND best_streak <= correct)
);
--> statement-breakpoint
CREATE INDEX idx_achievement_training_sessions_user
  ON achievement_training_sessions_v1 (user_id, completed_at);
--> statement-breakpoint
CREATE TABLE achievement_reviews_v1 (
  error_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  resolved_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_achievement_reviews_user
  ON achievement_reviews_v1 (user_id);
