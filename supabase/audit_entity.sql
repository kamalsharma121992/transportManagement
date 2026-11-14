-- Per-row audit history (run in Supabase SQL Editor)
-- Links audit_log entries to a trip / expense / etc. so eye-view can show that row's history.

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log (entity_type, entity_id, created_at DESC);

-- Replace write_audit_log with entity-aware version
DROP FUNCTION IF EXISTS write_audit_log(text, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION write_audit_log(
  p_gate text,
  p_user_id integer,
  p_user_name text,
  p_action text,
  p_screen text,
  p_summary text,
  p_entity_type text DEFAULT NULL,
  p_entity_id integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_gate(p_gate);
  INSERT INTO audit_log (user_id, user_name, action, screen, summary, entity_type, entity_id)
  VALUES (
    p_user_id,
    p_user_name,
    p_action,
    p_screen,
    left(COALESCE(p_summary, ''), 500),
    NULLIF(btrim(COALESCE(p_entity_type, '')), ''),
    p_entity_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION list_entity_audit_log(
  p_gate text,
  p_entity_type text,
  p_entity_id integer,
  p_limit integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_gate(p_gate);
  IF p_entity_type IS NULL OR btrim(p_entity_type) = '' OR p_entity_id IS NULL THEN
    RETURN '[]'::json;
  END IF;
  RETURN COALESCE((
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT id, user_id, user_name, action, screen, summary, entity_type, entity_id, created_at
      FROM audit_log
      WHERE entity_type = btrim(p_entity_type)
        AND entity_id = p_entity_id
      ORDER BY created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    ) t
  ), '[]'::json);
END;
$$;

-- Keep list_audit_log returning new columns too
CREATE OR REPLACE FUNCTION list_audit_log(p_gate text, p_limit integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_gate(p_gate);
  RETURN COALESCE((
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT id, user_id, user_name, action, screen, summary, entity_type, entity_id, created_at
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
    ) t
  ), '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION write_audit_log(text, integer, text, text, text, text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_entity_audit_log(text, text, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_audit_log(text, integer) TO anon, authenticated;
