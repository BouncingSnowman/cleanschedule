-- Veckoplan: Fix push_subscriptions table
-- Run this in Supabase Dashboard → SQL Editor

-- Add missing column if not present
ALTER TABLE push_subscriptions
ADD COLUMN IF NOT EXISTS notify_assigned BOOLEAN DEFAULT true;
