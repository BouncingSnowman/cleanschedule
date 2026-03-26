/**
 * CleanSchedule — Supabase Client
 * Uses the same project as Alien Sector (cywcnyimlhiwbbqqzvoe)
 */

const SUPABASE_URL = 'https://cywcnyimlhiwbbqqzvoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5d2NueWltbGhpd2JicXF6dm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NjIyOTYsImV4cCI6MjA4MTEzODI5Nn0.rVPlSGwbKz-HyODCz3f2tFW-9sm1X3zRVuWoDuwsM24';

let _session = null;

const ALLOWED_EMAILS = [
    'ingeholberg@gmail.com',
    'veronicasorianoholberg@gmail.com',
];

function authHeaders() {
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
    };
    if (_session?.access_token) {
        headers['Authorization'] = `Bearer ${_session.access_token}`;
    } else {
        headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    }
    return headers;
}

// --- Auth ---

export function signOut() {
    _session = null;
    localStorage.removeItem('cs_session');
}

export function signInWithGoogle() {
    const redirectTo = window.location.origin + window.location.pathname;
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
}

export function handleOAuthCallback() {
    // After Google login, Supabase redirects back with tokens in the URL hash
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return false;

    const params = new URLSearchParams(hash.substring(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const expires_in = params.get('expires_in');
    const token_type = params.get('token_type');

    if (access_token) {
        // Decode user from JWT
        const payload = JSON.parse(atob(access_token.split('.')[1]));

        // Check email whitelist
        if (!ALLOWED_EMAILS.includes(payload.email?.toLowerCase())) {
            history.replaceState(null, '', window.location.pathname);
            alert('Åtkomst nekad. Ditt konto har inte behörighet.');
            return false;
        }

        _session = {
            access_token,
            refresh_token,
            expires_in: Number(expires_in),
            token_type,
            user: {
                id: payload.sub,
                email: payload.email,
            },
        };
        saveSession(_session);

        // Clean the URL hash
        history.replaceState(null, '', window.location.pathname);
        return true;
    }
    return false;
}

export function getUser() {
    return _session?.user || null;
}

export function getUserId() {
    return _session?.user?.id || null;
}

export function isLoggedIn() {
    return !!_session?.access_token;
}

// Session persistence
function saveSession(session) {
    localStorage.setItem('cs_session', JSON.stringify(session));
}

export function restoreSession() {
    try {
        const stored = localStorage.getItem('cs_session');
        if (stored) {
            const session = JSON.parse(stored);
            // Verify email is whitelisted before restoring
            if (!ALLOWED_EMAILS.includes(session?.user?.email?.toLowerCase())) {
                localStorage.removeItem('cs_session');
                return false;
            }
            _session = session;
            return true;
        }
    } catch (e) {
        localStorage.removeItem('cs_session');
    }
    return false;
}

export async function refreshSession() {
    if (!_session?.refresh_token) return false;
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: _session.refresh_token }),
        });
        const data = await res.json();
        if (data.access_token) {
            _session = data;
            saveSession(data);
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

// --- Database (PostgREST) ---

async function dbFetch(table, options = {}) {
    const { method = 'GET', query = '', body = null, single = false } = options;
    const url = `${SUPABASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
    const headers = authHeaders();
    if (single) headers['Accept'] = 'application/vnd.pgrst.object+json';
    if (method === 'POST') headers['Prefer'] = 'return=representation';
    if (method === 'PATCH') headers['Prefer'] = 'return=representation';

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    // If 401, try refreshing session
    if (res.status === 401) {
        const refreshed = await refreshSession();
        if (refreshed) {
            return dbFetch(table, options); // retry
        }
        throw new Error('Session expired');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Database error: ${res.status}`);
    }

    if (method === 'DELETE') return null;
    return res.json();
}

// --- Public DB API (shared data — no user_id filter) ---

export async function dbSelect(table, query = '') {
    return dbFetch(table, { query });
}

export async function dbInsert(table, row) {
    const uid = getUserId();
    return dbFetch(table, {
        method: 'POST',
        body: { ...row, user_id: uid },
    });
}

export async function dbUpdate(table, id, updates) {
    return dbFetch(table, {
        method: 'PATCH',
        query: `id=eq.${id}`,
        body: updates,
    });
}

export async function dbDelete(table, id) {
    return dbFetch(table, {
        method: 'DELETE',
        query: `id=eq.${id}`,
    });
}

// --- Push Subscription helpers ---

export async function dbGetSubscription(endpoint) {
    const uid = getUserId();
    const results = await dbFetch('push_subscriptions', {
        query: `user_id=eq.${uid}&endpoint=eq.${encodeURIComponent(endpoint)}&limit=1`,
    });
    return results?.[0] || null;
}

export async function dbUpsertSubscription(sub) {
    const uid = getUserId();
    // Check if exists
    const existing = await dbGetSubscription(sub.endpoint);
    if (existing) {
        return dbFetch('push_subscriptions', {
            method: 'PATCH',
            query: `id=eq.${existing.id}`,
            body: {
                keys_p256dh: sub.keys_p256dh,
                keys_auth: sub.keys_auth,
                notify_morning: sub.notify_morning,
                morning_time: sub.morning_time,
                notify_unscheduled: sub.notify_unscheduled,
                notify_assigned: sub.notify_assigned,
            },
        });
    }
    return dbFetch('push_subscriptions', {
        method: 'POST',
        body: { ...sub, user_id: uid },
    });
}

export async function dbUpdateSubscriptionPrefs(endpoint, prefs) {
    const uid = getUserId();
    return dbFetch('push_subscriptions', {
        method: 'PATCH',
        query: `user_id=eq.${uid}&endpoint=eq.${encodeURIComponent(endpoint)}`,
        body: prefs,
    });
}
