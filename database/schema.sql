-- Mente Ágil — esquema completo para uma nova base SQLite/Cloudflare D1.
-- Não contém contas, históricos ou outros dados da base de produção.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ranking_accounts_v1 (
  user_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ranking_entries_v2 (
  id TEXT NOT NULL,
  name_key TEXT NOT NULL,
  nickname TEXT NOT NULL,
  operation TEXT NOT NULL,
  duration INTEGER NOT NULL,
  score INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  wrong INTEGER NOT NULL,
  best_streak INTEGER NOT NULL,
  played_at INTEGER NOT NULL,
  user_id TEXT,
  PRIMARY KEY (name_key, operation, duration)
);

CREATE TABLE IF NOT EXISTS ranking_sessions_v2 (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  name_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  duration INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  submitted INTEGER NOT NULL DEFAULT 0,
  user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ranking_sessions_user
  ON ranking_sessions_v2 (user_id);

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
  played_at INTEGER NOT NULL,
  user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ranking_attempts_name_played
  ON ranking_attempts_v1 (name_key, played_at);
CREATE INDEX IF NOT EXISTS idx_ranking_attempts_user_played
  ON ranking_attempts_v1 (user_id, played_at);

CREATE TABLE IF NOT EXISTS ranking_moderation_actions_v1 (
  id TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_secure_sessions_user_status
  ON ranking_secure_sessions_v1 (user_id, status);
CREATE INDEX IF NOT EXISTS idx_secure_sessions_expiry
  ON ranking_secure_sessions_v1 (expires_at);

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

CREATE INDEX IF NOT EXISTS idx_secure_answers_session
  ON ranking_secure_answers_v1 (session_id, answered_at);
CREATE INDEX IF NOT EXISTS idx_secure_answers_user_time
  ON ranking_secure_answers_v1 (user_id, answered_at);

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

CREATE INDEX IF NOT EXISTS idx_practice_errors_user_priority
  ON practice_errors_v1 (user_id, wrong_count DESC, last_wrong_at DESC);

-- Mantida por compatibilidade com instalações que aplicaram a antiga migração.
-- O painel e os endpoints administrativos já foram removidos da aplicação.
CREATE TABLE IF NOT EXISTS admin_login_attempts_v1 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  failed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_user_time
  ON admin_login_attempts_v1 (user_id, failed_at);

CREATE TABLE IF NOT EXISTS achievement_training_sessions_v1 (
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

CREATE INDEX IF NOT EXISTS idx_achievement_training_sessions_user
  ON achievement_training_sessions_v1 (user_id, completed_at);

CREATE TABLE IF NOT EXISTS achievement_reviews_v1 (
  error_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  resolved_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_achievement_reviews_user
  ON achievement_reviews_v1 (user_id);

CREATE TABLE IF NOT EXISTS specific_drill_sessions_v1 (
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

CREATE INDEX IF NOT EXISTS idx_specific_drill_sessions_user_completed
  ON specific_drill_sessions_v1 (user_id, completed_at DESC, id DESC);

PRAGMA optimize;

