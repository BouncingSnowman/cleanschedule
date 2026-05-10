-- CleanSchedule: Replace get_employee_id_for_email(text) with get_current_employee_id()
-- The old function accepted caller-supplied email, allowing employee ID probing via RPC.
-- The new function derives email from auth.jwt() internally — zero caller-controlled input.
-- Run in Supabase SQL Editor

-- =============================================================
-- 1. Create the new no-argument function
-- =============================================================
CREATE OR REPLACE FUNCTION get_current_employee_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM employees
  WHERE email = (auth.jwt()->> 'email')
  AND invited = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION get_current_employee_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_employee_id() TO authenticated;

-- =============================================================
-- 2. Update all RLS policies to use get_current_employee_id()
-- =============================================================

-- customers: employee read
DROP POLICY IF EXISTS "Employee read linked customers" ON customers;
CREATE POLICY "Employee read linked customers" ON customers FOR SELECT TO authenticated
  USING (id IN (SELECT DISTINCT customer_id FROM jobs WHERE employee_id = get_current_employee_id()));

-- employees: employee read self
DROP POLICY IF EXISTS "Employee read self" ON employees;
CREATE POLICY "Employee read self" ON employees FOR SELECT TO authenticated
  USING (id = get_current_employee_id());

-- jobs: employee read own jobs
DROP POLICY IF EXISTS "Employee read own jobs" ON jobs;
CREATE POLICY "Employee read own jobs" ON jobs FOR SELECT TO authenticated
  USING (employee_id = get_current_employee_id());

-- time_off: employee read own time off
DROP POLICY IF EXISTS "Employee read own time off" ON time_off;
CREATE POLICY "Employee read own time off" ON time_off FOR SELECT TO authenticated
  USING (employee_id = get_current_employee_id());

-- job_exceptions: employee read
DROP POLICY IF EXISTS "Employee read job exceptions" ON job_exceptions;
CREATE POLICY "Employee read job exceptions" ON job_exceptions FOR SELECT TO authenticated
  USING (job_id IN (SELECT id FROM jobs WHERE employee_id = get_current_employee_id()));

-- =============================================================
-- 3. Drop the old function that accepted caller-supplied email
-- =============================================================
DROP FUNCTION IF EXISTS get_employee_id_for_email(TEXT);
