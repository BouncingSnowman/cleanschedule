/**
 * Veckoplan — Settings (Notification Preferences)
 */

import { getUser, dbGetSetting, dbSetSetting, dbDeleteSetting } from './supabase.js?v=64';
import {
    dbGetSubscription, dbUpsertSubscription, dbUpdateSubscriptionPrefs
} from './supabase.js?v=64';

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

    const notifyUnscheduled = dbPrefs?.notify_unscheduled ?? true;
    const notifyAssigned = dbPrefs?.notify_assigned ?? true;
    const isSubscribed = !!existingSub;

    container.innerHTML = `
        <div class="settings-section">
            <h2 class="settings-title">🔔 Notiser</h2>
                <div class="settings-notice info">
                    <p>💡 <strong>Viktigt:</strong> För att ta emot notiser måste ditt anställdkort ha samma e-postadress som du loggar in med.</p>
                </div>
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
                            <div class="setting-label">📦 Nya oplanerade jobb</div>
                            <div class="setting-desc">Notis när ett nytt oplanerat jobb läggs till</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="toggle-unscheduled" ${notifyUnscheduled ? 'checked' : ''} ${!isSubscribed ? 'disabled' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-row" style="margin-top: 12px">
                        <div class="setting-info">
                            <div class="setting-label">✅ Tilldelat jobb</div>
                            <div class="setting-desc">Notis när du har blivit tilldelad ett nytt jobb</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="toggle-assigned" ${notifyAssigned ? 'checked' : ''} ${!isSubscribed ? 'disabled' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            `}
        </div>

        <div class="settings-section" style="margin-top: 24px">
            <h2 class="settings-title">📅 Kalender</h2>
            <div class="settings-card">
                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-label">⏰ Påminnelse</div>
                        <div class="setting-desc">Påminn mig innan varje jobb när jag exporterar till kalender</div>
                    </div>
                    <select id="select-reminder" class="form-select-sm">
                        <option value="0">Ingen påminnelse</option>
                        <option value="30">30 min innan</option>
                        <option value="60">1 timme innan</option>
                        <option value="120">2 timmar innan</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="settings-section" style="margin-top: 24px">
            <h2 class="settings-title">🤖 Implementera chatbot</h2>
            <div class="settings-card">
                <div class="setting-info" style="margin-bottom: 12px">
                    <div class="setting-desc">Klistra in ditt chatbot-skript (t.ex. från Chatbase). Skriptet aktiveras direkt och laddas vid varje inloggning.</div>
                </div>
                <textarea id="chatbot-script" class="form-input" rows="6" style="font-family: monospace; font-size: 0.82rem; resize: vertical;" placeholder="Klistra in &lt;script&gt;...&lt;/script&gt; här"></textarea>
                <div style="display:flex; gap:10px; margin-top:12px; align-items:center">
                    <button id="btn-save-chatbot" class="btn-primary">Spara &amp; aktivera</button>
                    <button id="btn-remove-chatbot" class="btn-ghost">Ta bort chatbot</button>
                    <span id="chatbot-status" style="font-size:0.85rem; color:var(--text-muted)"></span>
                </div>
            </div>
        </div>
    `;

    // --- Calendar Reminder handler ---
    const reminderSelect = document.getElementById('select-reminder');
    if (reminderSelect) {
        const saved = localStorage.getItem('cs_reminder_minutes') || '0';
        reminderSelect.value = saved;
        reminderSelect.addEventListener('change', () => {
            localStorage.setItem('cs_reminder_minutes', reminderSelect.value);
        });
    }

    // --- Chatbot handler ---
    const chatbotTextarea = document.getElementById('chatbot-script');
    const chatbotStatus = document.getElementById('chatbot-status');

    // Load existing script from DB
    const dbScript = await dbGetSetting('chatbot_script');
    if (chatbotTextarea && dbScript) chatbotTextarea.value = dbScript;
    if (dbScript && chatbotStatus) chatbotStatus.textContent = '✅ Chatbot aktiv';

    document.getElementById('btn-save-chatbot')?.addEventListener('click', async () => {
        const raw = chatbotTextarea?.value?.trim() || '';
        if (!raw) {
            chatbotStatus.textContent = '⚠️ Klistra in ett skript först.';
            return;
        }
        if (!raw.includes('<script') || !raw.includes('</script>')) {
            chatbotStatus.textContent = '❌ Skriptet verkar inte vara giltigt.';
            return;
        }
        chatbotStatus.textContent = 'Sparar...';
        await dbSetSetting('chatbot_script', raw);
        localStorage.setItem('cs_chatbot_script', raw); // local cache
        injectChatbotScript(raw);
        chatbotStatus.textContent = '✅ Chatbot sparad och aktiverad!';
        setTimeout(() => { chatbotStatus.textContent = '✅ Chatbot aktiv'; }, 3000);
    });

    document.getElementById('btn-remove-chatbot')?.addEventListener('click', async () => {
        await dbDeleteSetting('chatbot_script');
        localStorage.removeItem('cs_chatbot_script');
        if (chatbotTextarea) chatbotTextarea.value = '';
        chatbotStatus.textContent = 'Chatbot borttagen. Sidan laddas om...';
        setTimeout(() => location.reload(), 1500);
    });

    // --- Push Notification Event handlers ---
    if (!pushSupported) return;

    const pushToggle = document.getElementById('toggle-push');
    const unscheduledToggle = document.getElementById('toggle-unscheduled');
    const assignedToggle = document.getElementById('toggle-assigned');
    const prefsCard = document.getElementById('notification-prefs');

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
                    notify_unscheduled: true,
                    notify_assigned: true,
                });
                prefsCard?.classList.remove('disabled');
                document.querySelectorAll('#notification-prefs input').forEach(inp => inp.disabled = false);
                showSettingsStatus('✅ Push-notiser aktiverade!');
            } catch (e) {
                console.error('Push subscribe error:', e);
                pushToggle.checked = false;
                showSettingsStatus('❌ Fel: ' + e.message, true);
            }
        } else {
            // Unsubscribe
            const sub = await swRegistration.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
            prefsCard?.classList.add('disabled');
            document.querySelectorAll('#notification-prefs input').forEach(inp => inp.disabled = true);
        }
    });


    // Toggle unscheduled notification
    unscheduledToggle?.addEventListener('change', async () => {
        await savePrefs();
    });

    // Toggle assigned notification
    assignedToggle?.addEventListener('change', async () => {
        await savePrefs();
    });

    async function savePrefs() {
        const sub = await swRegistration.pushManager.getSubscription();
        if (!sub) return;
        try {
            await dbUpdateSubscriptionPrefs(sub.endpoint, {
                notify_unscheduled: unscheduledToggle?.checked ?? true,
                notify_assigned: assignedToggle?.checked ?? true,
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

function showSettingsStatus(msg, isError = false) {
    let el = document.getElementById('settings-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'settings-status';
        el.style.cssText = 'padding:12px 16px;border-radius:8px;margin-top:16px;font-size:0.9rem;';
        document.querySelector('.settings-section')?.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = isError ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)';
    el.style.color = isError ? '#f87171' : '#34d399';
    setTimeout(() => el.remove(), 5000);
}

/**
 * Extract inline script content and inject it into the page.
 * Only runs code from scripts the admin explicitly pasted.
 * Security: only allows scripts referencing known chatbot CDN domains.
 */
export function injectChatbotScript(raw) {
    if (!raw) return;

    // Whitelist of allowed chatbot CDN domains
    const ALLOWED_DOMAINS = [
        'chatbase.co',
        'crisp.chat',
        'tawk.to',
        'intercom.io',
        'tidio.com',
        'freshchat.com',
        'zopim.com',
        'zendesk.com',
    ];

    const hasTrustedDomain = ALLOWED_DOMAINS.some(domain => raw.includes(domain));
    if (!hasTrustedDomain) {
        console.warn('CleanSchedule: chatbot script rejected — domain not in allowlist.');
        return;
    }

    // Extract content between <script> tags
    const match = raw.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!match) return;
    const code = match[1].trim();
    if (!code) return;

    // Remove any existing injected chatbot script to avoid duplicates
    document.querySelectorAll('script[data-chatbot-inject]').forEach(s => s.remove());

    const el = document.createElement('script');
    el.setAttribute('data-chatbot-inject', '1');
    el.textContent = code;
    document.head.appendChild(el);
}
