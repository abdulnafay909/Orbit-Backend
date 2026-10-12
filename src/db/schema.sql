-- ORBIT database schema
-- Phase 17 adds real accounts, persistent sessions and user-owned general chats.
-- Run this file against the same PostgreSQL database used by ORBIT.
--
-- It is intentionally written to be safe for an existing Phase 1-16 database.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS user_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_user_id_fkey'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_user_id_unique
  ON students(user_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
  ON auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry
  ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated
  ON chat_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message_order INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, message_order)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_order
  ON chat_messages(conversation_id, message_order);

CREATE TABLE IF NOT EXISTS learning_sessions (
  student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  course JSONB NOT NULL,
  goal JSONB NOT NULL,
  preferences JSONB,
  existing_knowledge JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome JSONB NOT NULL,
  learning_path JSONB NOT NULL,
  current_task_id TEXT,
  completed_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  skipped_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  learning_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  state_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_tasks (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  task_order INTEGER NOT NULL,
  completion_evidence TEXT,
  completion_evidence_type TEXT,
  PRIMARY KEY (student_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_tasks_student_order
  ON learning_tasks(student_id, task_order);

CREATE TABLE IF NOT EXISTS student_skills (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  PRIMARY KEY (student_id, skill_id)
);

CREATE TABLE IF NOT EXISTS learning_history (
  id BIGSERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  history_order INTEGER NOT NULL,
  entry TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_history_student_order
  ON learning_history(student_id, history_order);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id BIGSERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  message_order INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  content TEXT NOT NULL,
  message_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_student_order
  ON conversation_messages(student_id, message_order);
