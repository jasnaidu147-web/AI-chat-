-- ==============================================================================
-- Migration: Full schema setup + print all required .env variables
-- Run in: Supabase Dashboard → SQL Editor → New Query
--         OR via: supabase db push
--
-- After execution, scroll to the "Messages" tab in the SQL Editor to see
-- every .env variable you need, ready to copy-paste.
-- ==============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT        PRIMARY KEY,
  title       TEXT        NOT NULL DEFAULT 'New Conversation',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'model', 'assistant', 'system')),
  content         TEXT        NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
  ON conversations(updated_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;

-- Public / demo policies (replace with auth.uid() checks for production)
DROP POLICY IF EXISTS "Public full access to conversations" ON conversations;
CREATE POLICY "Public full access to conversations"
  ON conversations FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to messages" ON messages;
CREATE POLICY "Public full access to messages"
  ON messages FOR ALL
  USING (true)
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. AUTO-UPDATE updated_at TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PRINT ALL REQUIRED .env VARIABLES
--    Reads live values from Supabase internals — no manual lookup needed.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_project_url        TEXT;
  v_anon_key           TEXT;
  v_service_role_key   TEXT;
  v_jwt_secret         TEXT;
  v_db_host            TEXT;
  v_db_name            TEXT;
  v_db_user            TEXT;
  v_ref                TEXT;
BEGIN

  -- ── Derive project ref from the current DB connection ──────────────────────
  SELECT current_database() INTO v_db_name;
  SELECT current_user       INTO v_db_user;

  -- ── Pull keys from Supabase's internal config schema ──────────────────────
  BEGIN
    SELECT decrypted_secret INTO v_jwt_secret
      FROM vault.decrypted_secrets
     WHERE name = 'jwt_secret'
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_secret := '(vault not accessible — copy from Dashboard: Project Settings > API > JWT Secret)';
  END;

  -- ── anon & service_role JWTs live in extensions.secrets ─────────────────────────
  BEGIN
    SELECT anon_key, service_role_key
      INTO v_anon_key, v_service_role_key
      FROM extensions.secrets   -- available in managed Supabase
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_anon_key         := '(copy from Dashboard: Project Settings > API > anon public)';
    v_service_role_key := '(copy from Dashboard: Project Settings > API > service_role secret)';
  END;

  -- ── Build project URL from DB hostname ────────────────────────────────────
  SELECT inet_server_addr()::TEXT INTO v_db_host;
  -- Pattern: db.<ref>.supabase.co  =>  ref is between first dot and ".supabase"
  v_ref         := split_part(v_db_host, '.', 2);
  v_project_url := 'https://' || v_ref || '.supabase.co';

  -- ─────────────────────────────────────────────────────────────────────────
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '       COPY THESE VALUES INTO YOUR  backend/.env                ';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'PORT=5000';
  RAISE NOTICE 'GEMINI_API_KEY=<get from https://aistudio.google.com/app/apikey>';
  RAISE NOTICE 'DEFAULT_MODEL=gemini-2.5-flash';
  RAISE NOTICE '';
  RAISE NOTICE 'SUPABASE_URL=%',             v_project_url;
  RAISE NOTICE 'SUPABASE_ANON_KEY=%',        COALESCE(v_anon_key,         '(see Dashboard)');
  RAISE NOTICE 'SUPABASE_SERVICE_ROLE_KEY=%',COALESCE(v_service_role_key, '(see Dashboard)');
  RAISE NOTICE '';
  RAISE NOTICE '--- Extra / optional ---';
  RAISE NOTICE 'DB_NAME=%',                  v_db_name;
  RAISE NOTICE 'DB_USER=%',                  v_db_user;
  RAISE NOTICE 'JWT_SECRET=%',               COALESCE(v_jwt_secret, '(see Dashboard)');
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Schema applied: tables, indexes, RLS policies and trigger ready.';
  RAISE NOTICE '=================================================================';

END $$;
