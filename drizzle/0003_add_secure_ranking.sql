CREATE TABLE IF NOT EXISTS ranking_secure_sessions_v1 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  name_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  duration INTEGER NOT NULL,
  tier TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  question_id TEXT NOT NULL,
  question_a INTEGER NOT NULL,
  question_b INTEGER NOT NULL,
  expected_answer INTEGER NOT NULL,
  question_started_at INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  correct INTEGER NOT NULL DEFAULT 0,
  wrong INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  wrong_streak INTEGER NOT NULL DEFAULT 0,
  answered_count INTEGER NOT NULL DEFAULT 0,
  total_response_ms INTEGER NOT NULL DEFAULT 0,
  violations INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_secure_sessions_user_status
ON ranking_secure_sessions_v1 (user_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_secure_sessions_expiry
ON ranking_secure_sessions_v1 (expires_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ranking_secure_answers_v1 (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  level INTEGER NOT NULL,
  a INTEGER NOT NULL,
  b INTEGER NOT NULL,
  expected_answer INTEGER NOT NULL,
  given_answer INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  response_ms INTEGER NOT NULL,
  answered_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_secure_answers_session
ON ranking_secure_answers_v1 (session_id, answered_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_secure_answers_user_time
ON ranking_secure_answers_v1 (user_id, answered_at);
