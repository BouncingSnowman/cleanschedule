-- CleanSchedule: Job Exceptions Migration
-- Run this in the Supabase SQL Editor
-- Adds per-occurrence overrides for recurring jobs (cancel / employee swap)

-- =============================================================
-- 1. Create job_exceptions table
-- =============================================================
CREATE TABLE job_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  exception_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cancelled', 'employee_override')),
  override_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (job_id, exception_date, type)
);

-- =============================================================
-- 2. Enable RLS
-- =============================================================
ALTER TABLE job_exceptions ENABLE ROW LEVEL SECURITY;

-- Owner-only access (matches existing pattern)
CREATE POLICY "Users own data" ON job_exceptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Employee read access (for "Mitt Schema")
CREATE POLICY "Employee read job exceptions" ON job_exceptions
  FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE employee_id = get_employee_id_for_email(auth.jwt()->>'email')
    )
  );
