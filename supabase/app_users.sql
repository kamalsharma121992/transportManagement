-- Users, roles, and audit log.
-- Run this in the Supabase SQL editor.
-- APP_ADMIN_GATE in .env must match the gate inserted below.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  admin_gate TEXT NOT NULL
);

INSERT INTO app_config (id, admin_gate)
VALUES (1, '9982a822091179e0baa679099a38ff57e1fdd1d9732ac952')
ON CONFLICT (id) DO UPDATE SET admin_gate = EXCLUDED.admin_gate;

CREATE TABLE IF NOT EXISTS app_roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_role_pages (
  role_id INTEGER NOT NULL REFERENCES app_roles(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  PRIMARY KEY (role_id, page_key)
);

CREATE TABLE IF NOT EXISTS app_users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES app_roles(id),
  driver_id INTEGER REFERENCES drivers(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique
  ON app_users (lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  screen TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_role_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_require_gate(p_gate text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_gate IS NULL OR p_gate <> (SELECT admin_gate FROM app_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION authenticate_user(p_username text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', u.id,
    'name', u.name,
    'username', u.username,
    'role', r.name,
    'driverId', u.driver_id,
    'driverName', d.name,
    'pages', COALESCE((
      SELECT json_agg(rp.page_key ORDER BY rp.page_key)
      FROM app_role_pages rp
      WHERE rp.role_id = r.id
    ), '[]'::json)
  )
  INTO result
  FROM app_users u
  JOIN app_roles r ON r.id = u.role_id
  LEFT JOIN drivers d ON d.id = u.driver_id
  WHERE lower(u.username) = lower(trim(p_username))
    AND u.is_active
    AND u.password_hash = crypt(p_password, u.password_hash);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION list_app_users(p_gate text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_gate(p_gate);
  RETURN COALESCE((
    SELECT json_agg(row_to_json(t) ORDER BY t.name)
    FROM (
      SELECT u.id, u.name, u.username, u.email, u.role_id, r.name AS role,
             u.driver_id, d.name AS driver_name, u.is_active
      FROM app_users u
      JOIN app_roles r ON r.id = u.role_id
      LEFT JOIN drivers d ON d.id = u.driver_id
    ) t
  ), '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION save_app_user(
  p_gate text,
  p_id integer,
  p_name text,
  p_username text,
  p_email text,
  p_password text,
  p_role_id integer,
  p_driver_id integer,
  p_active boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  new_id integer;
BEGIN
  PERFORM app_require_gate(p_gate);
  IF trim(p_name) = '' OR trim(p_username) = '' THEN
    RAISE EXCEPTION 'Name and username are required';
  END IF;
  IF p_id IS NULL AND (p_password IS NULL OR length(trim(p_password)) < 6) THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO app_users (name, username, email, password_hash, role_id, driver_id, is_active)
    VALUES (
      trim(p_name),
      trim(p_username),
      NULLIF(trim(COALESCE(p_email, '')), ''),
      crypt(p_password, gen_salt('bf')),
      p_role_id,
      p_driver_id,
      COALESCE(p_active, TRUE)
    )
    RETURNING id INTO new_id;
  ELSE
    UPDATE app_users SET
      name = trim(p_name),
      username = trim(p_username),
      email = NULLIF(trim(COALESCE(p_email, '')), ''),
      role_id = p_role_id,
      driver_id = p_driver_id,
      is_active = COALESCE(p_active, TRUE),
      password_hash = CASE
        WHEN p_password IS NULL OR trim(p_password) = '' THEN password_hash
        ELSE crypt(p_password, gen_salt('bf'))
      END
    WHERE id = p_id
    RETURNING id INTO new_id;
    IF new_id IS NULL THEN
      RAISE EXCEPTION 'User not found';
    END IF;
  END IF;
  RETURN json_build_object('id', new_id);
END;
$$;

CREATE OR REPLACE FUNCTION list_app_roles(p_gate text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_gate(p_gate);
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', r.id,
      'name', r.name,
      'pages', COALESCE((
        SELECT json_agg(rp.page_key ORDER BY rp.page_key)
        FROM app_role_pages rp
        WHERE rp.role_id = r.id
      ), '[]'::json)
    ) ORDER BY r.name)
    FROM app_roles r
  ), '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION save_app_role(
  p_gate text,
  p_id integer,
  p_name text,
  p_pages text[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id integer;
BEGIN
  PERFORM app_require_gate(p_gate);
  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Role name is required';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO app_roles (name) VALUES (trim(p_name)) RETURNING id INTO new_id;
  ELSE
    UPDATE app_roles SET name = trim(p_name) WHERE id = p_id RETURNING id INTO new_id;
    IF new_id IS NULL THEN
      RAISE EXCEPTION 'Role not found';
    END IF;
    DELETE FROM app_role_pages WHERE role_id = new_id;
  END IF;
  INSERT INTO app_role_pages (role_id, page_key)
  SELECT new_id, page_key FROM unnest(COALESCE(p_pages, ARRAY[]::text[])) AS page_key;
  RETURN json_build_object('id', new_id);
END;
$$;

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
      SELECT id, user_id, user_name, action, screen, summary, created_at
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
    ) t
  ), '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION write_audit_log(
  p_gate text,
  p_user_id integer,
  p_user_name text,
  p_action text,
  p_screen text,
  p_summary text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_gate(p_gate);
  INSERT INTO audit_log (user_id, user_name, action, screen, summary)
  VALUES (p_user_id, p_user_name, p_action, p_screen, left(COALESCE(p_summary, ''), 500));
END;
$$;

GRANT EXECUTE ON FUNCTION authenticate_user(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_app_users(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION save_app_user(text, integer, text, text, text, text, integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_app_roles(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION save_app_role(text, integer, text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_audit_log(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION write_audit_log(text, integer, text, text, text, text) TO anon, authenticated;

INSERT INTO app_roles (name)
VALUES ('Admin'), ('Account Manager'), ('Driver')
ON CONFLICT (name) DO NOTHING;

INSERT INTO app_role_pages (role_id, page_key)
SELECT r.id, page_key
FROM app_roles r
CROSS JOIN unnest(ARRAY[
  'dashboard', 'trips', 'routes', 'expenses', 'expense-advances', 'vehicles',
  'capital', 'credit-cards', 'reports', 'payroll', 'admin', 'audit', 'submit'
]) AS page_key
WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

INSERT INTO app_role_pages (role_id, page_key)
SELECT r.id, page_key
FROM app_roles r
CROSS JOIN unnest(ARRAY[
  'dashboard', 'trips', 'expenses', 'expense-advances', 'vehicles',
  'capital', 'credit-cards', 'reports', 'payroll'
]) AS page_key
WHERE r.name = 'Account Manager'
ON CONFLICT DO NOTHING;

INSERT INTO app_role_pages (role_id, page_key)
SELECT r.id, page_key
FROM app_roles r
CROSS JOIN unnest(ARRAY['trips', 'submit']) AS page_key
WHERE r.name = 'Driver'
ON CONFLICT DO NOTHING;

INSERT INTO app_users (name, username, password_hash, role_id, is_active)
SELECT 'Admin', 'admin', crypt('Admin@123', gen_salt('bf')), r.id, TRUE
FROM app_roles r
WHERE r.name = 'Admin'
  AND NOT EXISTS (SELECT 1 FROM app_users WHERE lower(username) = 'admin');
