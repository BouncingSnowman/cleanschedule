-- CleanSchedule: Tighten all RLS policies to TO authenticated
-- Defense-in-depth: prevents any accidental anon access

-- customers
DROP POLICY IF EXISTS "Whitelist access" ON customers;
CREATE POLICY "Whitelist access" ON customers FOR ALL TO authenticated
  USING (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));

DROP POLICY IF EXISTS "Employee read linked customers" ON customers;
CREATE POLICY "Employee read linked customers" ON customers FOR SELECT TO authenticated
  USING (id IN (SELECT DISTINCT customer_id FROM jobs WHERE employee_id = get_employee_id_for_email(auth.jwt()->> 'email')));

-- employees
DROP POLICY IF EXISTS "Whitelist access" ON employees;
CREATE POLICY "Whitelist access" ON employees FOR ALL TO authenticated
  USING (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));

DROP POLICY IF EXISTS "Employee read self" ON employees;
CREATE POLICY "Employee read self" ON employees FOR SELECT TO authenticated
  USING (id = get_employee_id_for_email(auth.jwt()->> 'email'));

-- jobs
DROP POLICY IF EXISTS "Whitelist access" ON jobs;
CREATE POLICY "Whitelist access" ON jobs FOR ALL TO authenticated
  USING (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));

DROP POLICY IF EXISTS "Employee read own jobs" ON jobs;
CREATE POLICY "Employee read own jobs" ON jobs FOR SELECT TO authenticated
  USING (employee_id = get_employee_id_for_email(auth.jwt()->> 'email'));

-- time_off
DROP POLICY IF EXISTS "Whitelist access" ON time_off;
CREATE POLICY "Whitelist access" ON time_off FOR ALL TO authenticated
  USING (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));

DROP POLICY IF EXISTS "Employee read own time off" ON time_off;
CREATE POLICY "Employee read own time off" ON time_off FOR SELECT TO authenticated
  USING (employee_id = get_employee_id_for_email(auth.jwt()->> 'email'));

-- job_exceptions
DROP POLICY IF EXISTS "Whitelist access" ON job_exceptions;
CREATE POLICY "Whitelist access" ON job_exceptions FOR ALL TO authenticated
  USING (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));

DROP POLICY IF EXISTS "Employee read job exceptions" ON job_exceptions;
CREATE POLICY "Employee read job exceptions" ON job_exceptions FOR SELECT TO authenticated
  USING (job_id IN (SELECT id FROM jobs WHERE employee_id = get_employee_id_for_email(auth.jwt()->> 'email')));

-- push_subscriptions
DROP POLICY IF EXISTS "Users own subscriptions" ON push_subscriptions;
CREATE POLICY "Users own subscriptions" ON push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Whitelist access" ON push_subscriptions;
CREATE POLICY "Whitelist access" ON push_subscriptions FOR ALL TO authenticated
  USING (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'))
  WITH CHECK (auth.jwt()->> 'email' IN ('ingeholberg@gmail.com','veronicasorianoholberg@gmail.com'));

-- app_settings
DROP POLICY IF EXISTS "Admins can manage settings" ON app_settings;
CREATE POLICY "Admins can manage settings" ON app_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM employees WHERE employees.email = auth.email() AND employees.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can read settings" ON app_settings;
CREATE POLICY "Authenticated users can read settings" ON app_settings FOR SELECT TO authenticated
  USING (true);
