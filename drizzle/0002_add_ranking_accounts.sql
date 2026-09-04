CREATE TABLE IF NOT EXISTS ranking_accounts_v1 (
  user_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE ranking_entries_v2 ADD COLUMN user_id TEXT;
--> statement-breakpoint
ALTER TABLE ranking_attempts_v1 ADD COLUMN user_id TEXT;
--> statement-breakpoint
ALTER TABLE ranking_sessions_v2 ADD COLUMN user_id TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ranking_attempts_user_played
ON ranking_attempts_v1 (user_id, played_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ranking_sessions_user
ON ranking_sessions_v2 (user_id);
