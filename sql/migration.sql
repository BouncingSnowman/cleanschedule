-- CleanSchedule: Supabase Database Migration
-- Run this in the SQL Editor at: https://supabase.com/dashboard → Your project → SQL Editor

-- Kunder
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  estimated_hours REAL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Anställda
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  type TEXT DEFAULT 'fulltime',
  color TEXT,
  default_hours REAL DEFAULT 40,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Jobb
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  date DATE,
  start_time TEXT,
  hours REAL,
  recurring TEXT DEFAULT 'none',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ledighet
CREATE TABLE time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security: varje användare ser BARA sin data
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own data" ON customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON employees FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON jobs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON time_off FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
