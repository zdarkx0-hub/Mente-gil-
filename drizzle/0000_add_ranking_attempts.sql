CREATE TABLE IF NOT EXISTS ranking_attempts_v1 (
  id TEXT PRIMARY KEY,
  name_key TEXT NOT NULL,
  nickname TEXT NOT NULL,
  operation TEXT NOT NULL,
  duration INTEGER NOT NULL,
  score INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  wrong INTEGER NOT NULL,
  best_streak INTEGER NOT NULL,
  played_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ranking_attempts_name_played
ON ranking_attempts_v1 (name_key, played_at);
