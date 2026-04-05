-- Fix job_exceptions RLS: replace user_id-based policy with whitelist policy
-- (matches the pattern used by all other CleanSchedule tables)

-- Drop the old restrictive policies
DROP POLICY IF EXISTS "Users own data" ON job_exceptions;
DROP POLICY IF EXISTS "Employee read job exceptions" ON job_exceptions;

-- Add whitelist policy matching other tables
CREATE POLICY "Whitelist access" ON job_exceptions FOR ALL
  USING (auth.jwt()->>'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->>'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));

-- Employee read access (for "Mitt Schema")
CREATE POLICY "Employee read job exceptions" ON job_exceptions
  FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE employee_id = get_employee_id_for_email(auth.jwt()->>'email')
    )
  );
