-- CleanSchedule: Add is_admin column + update check_user_role()
-- Run this in the Supabase SQL Editor

-- 1. Add is_admin column
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Set existing admins as is_admin (based on current hardcoded emails)
UPDATE employees SET is_admin = true WHERE email IN (
  'ingeholberg@gmail.com',
  'veronicasorianoholberg@gmail.com'
);

-- 3. Update check_user_role() to use DB-based admin check
CREATE OR REPLACE FUNCTION check_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
BEGIN
  user_email := auth.jwt()->>'email';

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
