ALTER TABLE achievement_training_sessions_v1
  ADD COLUMN operation TEXT NOT NULL DEFAULT 'mix'
  CHECK (operation IN ('add', 'sub', 'mul', 'mix'));
