-- CleanSchedule: App settings table for cross-device persistence
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Admins can read and write, employees can only read
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings"
    ON app_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.email = auth.email()
            AND employees.is_admin = true
        )
    );

CREATE POLICY "Authenticated users can read settings"
    ON app_settings FOR SELECT
    USING (auth.role() = 'authenticated');
