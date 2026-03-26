/**
 * Veckoplan — Settings (Notification Preferences)
 */

import { getUser } from './supabase.js?v=8';
import {
    dbGetSubscription, dbUpsertSubscription, dbUpdateSubscriptionPrefs
} from './supabase.js?v=8';

const VAPID_PUBLIC_KEY = 'BJC_-JfmMRGUnnkfibR52IGARups1q-t-jOGLee8FoA8G_oHH-v9QNf3PrqGrmz_gVWCLAzwSZN8A1gd72q4E_c';

export function initSettings() {}

export async function renderSettings() {
    const container = document.getElementById('settings-content');
    const user = getUser();
    if (!container || !user) return;

    // Check push support
    const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    const swRegistration = pushSupported ? await navigator.serviceWorker.ready : null;
    let existingSub = null;
    let dbPrefs = null;

    if (swRegistration) {
        existingSub = await swRegistration.pushManager.getSubscription();
    }

    // Check if we have saved prefs in DB
    if (existingSub) {
        try {
            dbPrefs = await dbGetSubscription(existingSub.endpoint);
        } catch (e) { /* ignore */ }
    }

    const notifyMorning = dbPrefs?.notify_morning ?? true;
    const morningTime = dbPrefs?.morning_time ?? '07:00';
    const notifyUnscheduled = dbPrefs?.notify_unscheduled ?? true;
    const isSubscribed = !!existingSub;

    container.innerHTML = `
        <div class="settings-section">
            <h2 class="settings-title">🔔 Notiser</h2>
            ${!pushSupported ? `
                <div class="settings-notice warning">
                    <p>Push-notiser stöds inte i den här webbläsaren.</p>
                    <p>Prova att lägga till appen på hemskärmen (Safari → Dela → Lägg till på hemskärmen).</p>
                </div>
            ` : `
                <div class="settings-card">
                    <div class="setting-row">
                        <div class="setting-info">
                            <div class="setting-label">Aktivera push-notiser</div>
                            <div class="setting-desc">Få notiser om dina jobb direkt på mobilen</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="toggle-push" ${isSubscribed ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <div class="settings-card ${!isSubscribed ? 'disabled' : ''}" id="notification-prefs">
                    <div class="setting-row">
                        <div class="setting-info">
                            <div class="setting-label">📅 Morgon-påminnelse</div>
                            <div class="setting-desc">Få en sammanfattning av dagens jobb varje morgon</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="toggle-morning" ${notifyMorning ? 'checked' : ''} ${!isSubscribed ? 'disabled' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="setting-row sub-setting" id="morning-time-row" style="${notifyMorning ? '' : 'display:none'}">
                        <div class="setting-info">
                            <div class="setting-label">Tid</div>
                        </div>
                        <input type="time" id="morning-time" class="time-input" value="${morningTime}" ${!isSubscribed ? 'disabled' : ''}>
                    </div>

                    <div class="setting-row" style="margin-top: 12px">
                        <div class="setting-info">
                            <div class="setting-label">📦 Nya oplanerade jobb</div>
                            <div class="setting-desc">Notis när ett nytt oplanerat jobb läggs till</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="toggle-unscheduled" ${notifyUnscheduled ? 'checked' : ''} ${!isSubscribed ? 'disabled' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            `}
        </div>
    `;

    // --- Event handlers ---
    if (!pushSupported) return;

    const pushToggle = document.getElementById('toggle-push');
    const morningToggle = document.getElementById('toggle-morning');
    const morningTimeInput = document.getElementById('morning-time');
    const unscheduledToggle = document.getElementById('toggle-unscheduled');
    const prefsCard = document.getElementById('notification-prefs');
    const timeRow = document.getElementById('morning-time-row');

    // Toggle push on/off
    pushToggle?.addEventListener('change', async () => {
        if (pushToggle.checked) {
            // Subscribe
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                pushToggle.checked = false;
                return;
            }
            try {
                const sub = await swRegistration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
                const keys = sub.toJSON().keys;
                await dbUpsertSubscription({
                    endpoint: sub.endpoint,
                    keys_p256dh: keys.p256dh,
                    keys_auth: keys.auth,
                    notify_morning: true,
                    morning_time: '07:00',
                    notify_unscheduled: true,
                });
                prefsCard?.classList.remove('disabled');
                document.querySelectorAll('#notification-prefs input').forEach(inp => inp.disabled = false);
            } catch (e) {
                console.error('Push subscribe error:', e);
                pushToggle.checked = false;
            }
        } else {
            // Unsubscribe
            const sub = await swRegistration.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
            prefsCard?.classList.add('disabled');
            document.querySelectorAll('#notification-prefs input').forEach(inp => inp.disabled = true);
        }
    });

    // Toggle morning notification
    morningToggle?.addEventListener('change', async () => {
        if (timeRow) timeRow.style.display = morningToggle.checked ? '' : 'none';
        await savePrefs();
    });

    // Change morning time
    morningTimeInput?.addEventListener('change', async () => {
        await savePrefs();
    });

    // Toggle unscheduled notification
    unscheduledToggle?.addEventListener('change', async () => {
        await savePrefs();
    });

    async function savePrefs() {
        const sub = await swRegistration.pushManager.getSubscription();
        if (!sub) return;
        try {
            await dbUpdateSubscriptionPrefs(sub.endpoint, {
                notify_morning: morningToggle?.checked ?? true,
                morning_time: morningTimeInput?.value ?? '07:00',
                notify_unscheduled: unscheduledToggle?.checked ?? true,
            });
        } catch (e) {
            console.error('Save prefs error:', e);
        }
    }
}

// Convert VAPID key from base64url to Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
    return arr;
}
