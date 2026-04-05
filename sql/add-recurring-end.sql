-- CleanSchedule: Add recurring_end to jobs table
-- Run this in the Supabase SQL Editor
-- Allows recurring jobs to have an end date for series splitting

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recurring_end DATE;
