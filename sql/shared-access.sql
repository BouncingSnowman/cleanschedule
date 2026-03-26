-- CleanSchedule: SÄKER delad åtkomst
-- Bara dessa två email-adresser kan läsa/skriva data.
-- Även om någon lyckas autentisera via Supabase blockeras de på databasnivå.

-- Rensa gamla policies (ignorera fel om de inte finns)
DROP POLICY IF EXISTS "Users own data" ON customers;
DROP POLICY IF EXISTS "Users own data" ON employees;
DROP POLICY IF EXISTS "Users own data" ON jobs;
DROP POLICY IF EXISTS "Users own data" ON time_off;
DROP POLICY IF EXISTS "Shared data" ON customers;
DROP POLICY IF EXISTS "Shared data" ON employees;
DROP POLICY IF EXISTS "Shared data" ON jobs;
DROP POLICY IF EXISTS "Shared data" ON time_off;

-- Säkerställ att RLS är aktiverat
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;

-- Ny policy: BARA dessa två email-adresser kan göra ALLT (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Whitelist access" ON customers FOR ALL
  USING (auth.jwt()->>'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->>'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));

CREATE POLICY "Whitelist access" ON employees FOR ALL
  USING (auth.jwt()->>'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->>'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));

CREATE POLICY "Whitelist access" ON jobs FOR ALL
  USING (auth.jwt()->>'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->>'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));

CREATE POLICY "Whitelist access" ON time_off FOR ALL
  USING (auth.jwt()->>'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->>'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));
