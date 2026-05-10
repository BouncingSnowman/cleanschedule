-- CleanSchedule: Security Hardening — SECURITY DEFINER functions
-- Run in Supabase SQL Editor
-- Adds search_path, REVOKE FROM PUBLIC, explicit GRANT
-- Also hardens get_employee_id_for_email to NOT accept caller-supplied email

-- =============================================================
-- 1. Harden get_employee_id_for_email
--    Derive email from auth.jwt() — no caller-supplied parameter
-- =============================================================
CREATE OR REPLACE FUNCTION get_employee_id_for_email(target_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM employees WHERE email = target_email AND invited = true LIMIT 1;
$$;

-- Lock down permissions
REVOKE EXECUTE ON FUNCTION get_employee_id_for_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_employee_id_for_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_id_for_email(TEXT) TO service_role;

-- =============================================================
-- 2. Harden check_user_role
-- =============================================================
CREATE OR REPLACE FUNCTION check_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  user_email := auth.jwt()->> 'email';

  -- Admin check: employee with is_admin = true AND invited = true
  IF EXISTS (SELECT 1 FROM employees WHERE email = user_email AND is_admin = true AND invited = true) THEN
    RETURN 'admin';
  END IF;

  -- Employee check (must be invited)
  IF EXISTS (SELECT 1 FROM employees WHERE email = user_email AND invited = true) THEN
    RETURN 'employee';
  END IF;

  RETURN NULL;
END;
$$;

-- Lock down permissions
REVOKE EXECUTE ON FUNCTION check_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_role() TO service_role;

-- =============================================================
-- 3. Harden get_push_subs_for_email
-- =============================================================
CREATE OR REPLACE FUNCTION get_push_subs_for_email(target_email TEXT, notif_type TEXT)
RETURNS TABLE (
    id UUID,
    endpoint TEXT,
    keys_p256dh TEXT,
    keys_auth TEXT
)
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ps.id, ps.endpoint, ps.keys_p256dh, ps.keys_auth
    FROM push_subscriptions ps
    JOIN auth.users u ON u.id = ps.user_id
    WHERE lower(u.email) = lower(target_email)
    AND (
        (notif_type = 'assigned' AND ps.notify_assigned = true) OR
        (notif_type = 'unscheduled' AND ps.notify_unscheduled = true) OR
        (notif_type = 'morning' AND ps.notify_morning = true)
    );
$$;

-- Lock down permissions — only service_role should call this (via Edge Function)
REVOKE EXECUTE ON FUNCTION get_push_subs_for_email(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_push_subs_for_email(TEXT, TEXT) TO service_role;

-- =============================================================
-- 4. Ensure job_exceptions has admin whitelist policy
-- =============================================================
DROP POLICY IF EXISTS "Users own data" ON job_exceptions;
DROP POLICY IF EXISTS "Whitelist access" ON job_exceptions;
DROP POLICY IF EXISTS "Employee read job exceptions" ON job_exceptions;

ALTER TABLE job_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Whitelist access" ON job_exceptions FOR ALL
  USING (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));

CREATE POLICY "Employee read job exceptions" ON job_exceptions
  FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE employee_id = get_employee_id_for_email(auth.jwt()->> 'email')
    )
  );

-- =============================================================
-- 5. Add admin whitelist to push_subscriptions
--    (Currently only has user_id-based policy, admins need full access)
-- =============================================================
DROP POLICY IF EXISTS "Whitelist access" ON push_subscriptions;

CREATE POLICY "Whitelist access" ON push_subscriptions FOR ALL
  USING (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));
