-- CleanSchedule: Employee Portal — Access Layer
-- Run this in the Supabase SQL Editor
-- Adds employee self-service login with read-only scoped access

-- =============================================================
-- 1. Add 'invited' flag to employees table
-- =============================================================
ALTER TABLE employees ADD COLUMN IF NOT EXISTS invited BOOLEAN DEFAULT false;

-- =============================================================
-- 2. Helper function: get employee_id for an email
--    SECURITY DEFINER so it bypasses RLS (avoids recursion)
-- =============================================================
CREATE OR REPLACE FUNCTION get_employee_id_for_email(target_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM employees WHERE email = target_email AND invited = true LIMIT 1;
$$;

-- =============================================================
-- 3. RPC: check_user_role() — returns 'admin', 'employee', or NULL
-- =============================================================
CREATE OR REPLACE FUNCTION check_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
BEGIN
  user_email := auth.jwt()->>'email';

  -- Admin check
  IF user_email IN ('ingeholberg@gmail.com', 'veronicasorianoholberg@gmail.com') THEN
    RETURN 'admin';
  END IF;

  -- Employee check (must be invited)
  IF EXISTS (SELECT 1 FROM employees WHERE email = user_email AND invited = true) THEN
    RETURN 'employee';
  END IF;

  RETURN NULL;
END;
$$;

-- =============================================================
-- 4. RLS Policies — Employee read-only access (scoped)
-- =============================================================

-- Drop old policies first (safe to ignore errors if they don't exist)
DROP POLICY IF EXISTS "Employee read self" ON employees;
DROP POLICY IF EXISTS "Employee read own jobs" ON jobs;
DROP POLICY IF EXISTS "Employee read linked customers" ON customers;
DROP POLICY IF EXISTS "Employee read own time off" ON time_off;

-- Employees: can read their own employee record
CREATE POLICY "Employee read self" ON employees FOR SELECT
  USING (
    id = get_employee_id_for_email(auth.jwt()->>'email')
  );

-- Jobs: employees can read jobs assigned to them
CREATE POLICY "Employee read own jobs" ON jobs FOR SELECT
  USING (
    employee_id = get_employee_id_for_email(auth.jwt()->>'email')
  );

-- Customers: employees can read customers they have jobs with
CREATE POLICY "Employee read linked customers" ON customers FOR SELECT
  USING (
    id IN (
      SELECT DISTINCT customer_id FROM jobs
      WHERE employee_id = get_employee_id_for_email(auth.jwt()->>'email')
    )
  );

-- Time off: employees can read their own time off
CREATE POLICY "Employee read own time off" ON time_off FOR SELECT
  USING (
    employee_id = get_employee_id_for_email(auth.jwt()->>'email')
  );
