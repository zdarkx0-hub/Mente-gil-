CREATE TABLE IF NOT EXISTS practice_errors_v1 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  level INTEGER NOT NULL,
  a INTEGER NOT NULL,
  b INTEGER NOT NULL,
  expected_answer INTEGER NOT NULL,
  last_given INTEGER NOT NULL,
  wrong_count INTEGER NOT NULL DEFAULT 1,
  last_wrong_at INTEGER NOT NULL,
  UNIQUE (user_id, operation, a, b, expected_answer)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_practice_errors_user_priority
ON practice_errors_v1 (user_id, wrong_count DESC, last_wrong_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS admin_login_attempts_v1 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  failed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_user_time
ON admin_login_attempts_v1 (user_id, failed_at);
