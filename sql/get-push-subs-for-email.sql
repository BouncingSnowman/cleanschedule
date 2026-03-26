-- Veckoplan: SQL function to look up push subscriptions by employee email
-- This does a direct JOIN between push_subscriptions and auth.users
-- Run in Supabase Dashboard → SQL Editor

CREATE OR REPLACE FUNCTION get_push_subs_for_email(target_email TEXT, notif_type TEXT)
RETURNS TABLE (
    id UUID,
    endpoint TEXT,
    keys_p256dh TEXT,
    keys_auth TEXT
)
LANGUAGE SQL SECURITY DEFINER
AS $$
    SELECT ps.id, ps.endpoint, ps.keys_p256dh, ps.keys_auth
    FROM push_subscriptions ps
    JOIN auth.users u ON u.id = ps.user_id
    WHERE lower(u.email) = lower(target_email)
    AND (
        (notif_type = 'assigned' AND ps.notify_assigned = true) OR
        (notif_type = 'unscheduled' AND ps.notify_unscheduled = true) OR
        (notif_type = 'morning' AND ps.notify_morning = true)
    );
$$;
