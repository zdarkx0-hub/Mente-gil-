-- Dados totalmente fictícios para desenvolvimento local.
-- Execute somente depois de database/schema.sql.

BEGIN TRANSACTION;

INSERT OR IGNORE INTO ranking_accounts_v1 (
  user_id, nickname, name_key, created_at
) VALUES (
  'demo-user', 'AlunoDemo', 'alunodemo', 1788552000000
);

INSERT OR IGNORE INTO ranking_attempts_v1 (
  id, name_key, nickname, operation, duration, score,
  correct, wrong, best_streak, played_at, user_id
) VALUES (
  'demo-attempt-1', 'alunodemo', 'AlunoDemo', 'add', 60, 10000,
  10, 0, 10, 1788552060000, 'demo-user'
);

INSERT OR IGNORE INTO ranking_entries_v2 (
  id, name_key, nickname, operation, duration, score,
  correct, wrong, best_streak, played_at, user_id
) VALUES (
  'demo-entry-1', 'alunodemo', 'AlunoDemo', 'add', 60, 10000,
  10, 0, 10, 1788552060000, 'demo-user'
);

INSERT OR IGNORE INTO achievement_training_sessions_v1 (
  id, user_id, duration, started_at, completed_at,
  correct, wrong, best_streak, operation
) VALUES (
  'demo-training-1', 'demo-user', 60, 1788552000000, 1788552060000,
  10, 0, 10, 'add'
);

INSERT OR IGNORE INTO specific_drill_sessions_v1 (
  id, user_id, config_json, question_count,
  correct, wrong, best_streak, completed_at
) VALUES (
  'demo-drill-1', 'demo-user',
  '{"operation":"add","skill":"no-carry","min":10,"max":99}',
  10, 9, 1, 6, 1788552120000
);

COMMIT;
