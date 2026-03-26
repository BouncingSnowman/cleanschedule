-- Veckoplan: Add notify_assigned column to push_subscriptions
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE push_subscriptions
ADD COLUMN IF NOT EXISTS notify_assigned BOOLEAN DEFAULT true;
