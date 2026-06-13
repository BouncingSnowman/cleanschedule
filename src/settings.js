/**
 * Veckoplan — Settings (Notification Preferences)
 */

import { getUser, dbGetSetting, dbSetSetting, dbDeleteSetting } from './supabase.js?v=74';
import {
    dbGetSubscription, dbUpsertSubscription, dbUpdateSubscriptionPrefs
} from './supabase.js?v=74';

const VAPID_PUBLIC_KEY = 'BCXAqqinjBdUeX1wgmfCDdM_T6p_ARQDu4XWd8M-Tmk87N-fxo5Ko7PgBs9U24ghn18adqWdGJ0dYiEkSIP4PYI';

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
                    <div class="setting-desc">Välj din chatbot-leverantör och ange ditt widget-ID. Chatboten laddas automatiskt vid inloggning.</div>
                </div>
                <div class="form-group">
                    <label for="chatbot-provider">Leverantör</label>
                    <select id="chatbot-provider" class="form-input">
                        <option value="">— Välj leverantör —</option>
                        <option value="clientrelay">ClientRelay</option>
                        <option value="chatbase">Chatbase</option>
                        <option value="crisp">Crisp</option>
                        <option value="tawk">Tawk.to</option>
                        <option value="tidio">Tidio</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="chatbot-widget-id">Widget-ID</label>
                    <input type="text" id="chatbot-widget-id" class="form-input" placeholder="Ditt widget-ID från leverantören">
                </div>
                <div style="display:flex; gap:10px; margin-top:12px; align-items:center">
                    <button id="btn-save-chatbot" class="btn-primary">Spara & aktivera</button>
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
    const providerSelect = document.getElementById('chatbot-provider');
    const widgetIdInput = document.getElementById('chatbot-widget-id');
    const chatbotStatus = document.getElementById('chatbot-status');

    // Load existing config from DB
    const dbChatbot = await dbGetSetting('chatbot_script');
    if (dbChatbot) {
        try {
            const parsed = JSON.parse(dbChatbot);
            if (parsed.provider && providerSelect) providerSelect.value = parsed.provider;
            if (parsed.widgetId && widgetIdInput) widgetIdInput.value = parsed.widgetId;
            if (chatbotStatus) chatbotStatus.textContent = '✅ Chatbot aktiv';
        } catch {
            // Legacy raw script — clear it, it's not safe
            console.warn('CleanSchedule: legacy raw chatbot script found, clearing.');
            await dbDeleteSetting('chatbot_script');
            localStorage.removeItem('cs_chatbot_script');
        }
    }

    document.getElementById('btn-save-chatbot')?.addEventListener('click', async () => {
        const provider = providerSelect?.value || '';
        const widgetId = widgetIdInput?.value?.trim() || '';
        if (!provider) {
            chatbotStatus.textContent = '⚠️ Välj en leverantör.';
            return;
        }
        if (!widgetId) {
            chatbotStatus.textContent = '⚠️ Ange widget-ID.';
            return;
        }
        // Validate widget ID: alphanumeric, dashes, underscores only
        if (!/^[a-zA-Z0-9_-]+$/.test(widgetId)) {
            chatbotStatus.textContent = '❌ Widget-ID får bara innehålla bokstäver, siffror, bindestreck och understreck.';
            return;
        }
        const config = JSON.stringify({ provider, widgetId });
        chatbotStatus.textContent = 'Sparar...';
        await dbSetSetting('chatbot_script', config);
        localStorage.setItem('cs_chatbot_script', config);
        injectChatbotScript(config);
        chatbotStatus.textContent = '✅ Chatbot sparad och aktiverad!';
        setTimeout(() => { chatbotStatus.textContent = '✅ Chatbot aktiv'; }, 3000);
    });

    document.getElementById('btn-remove-chatbot')?.addEventListener('click', async () => {
        await dbDeleteSetting('chatbot_script');
        localStorage.removeItem('cs_chatbot_script');
        if (providerSelect) providerSelect.value = '';
        if (widgetIdInput) widgetIdInput.value = '';
        // Remove any existing injected chatbot
        document.querySelectorAll('script[data-chatbot-inject]').forEach(s => s.remove());
        document.querySelectorAll('iframe[data-chatbot-inject]').forEach(s => s.remove());
        chatbotStatus.textContent = '🗑️ Chatbot borttagen.';
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
 * Inject chatbot widget by provider + widget ID.
 * Security: NO user-supplied code executes. Script is generated from
 * a hardcoded template per provider. Widget IDs are alphanumeric only.
 */
export function injectChatbotScript(configStr) {
    if (!configStr) return;

    let config;
    try {
        config = JSON.parse(configStr);
    } catch {
        // Legacy raw script — refuse to execute
        console.warn('CleanSchedule: raw chatbot script rejected. Use provider + widget ID.');
        return;
    }

    const { provider, widgetId } = config;
    if (!provider || !widgetId) return;

    // Strict validation: alphanumeric, dashes, underscores only
    if (!/^[a-zA-Z0-9_-]+$/.test(widgetId)) {
        console.warn('CleanSchedule: invalid widget ID rejected.');
        return;
    }

    // Remove any existing chatbot injection
    document.querySelectorAll('script[data-chatbot-inject]').forEach(s => s.remove());
    document.querySelectorAll('iframe[data-chatbot-inject]').forEach(s => s.remove());

    // Provider templates — each generates a script with a known CDN URL
    const PROVIDERS = {
        clientrelay: (id) => {
            const el = document.createElement('script');
            el.src = 'https://clientrelay.tech/widget/chatbot.js';
            el.setAttribute('data-client', id);
            el.setAttribute('data-chatbot-inject', '1');
            el.defer = true;
            document.head.appendChild(el);
        },
        chatbase: (id) => {
            const el = document.createElement('script');
            el.src = `https://www.chatbase.co/embed.min.js`;
            el.setAttribute('chatbotId', id);
            el.setAttribute('data-chatbot-inject', '1');
            el.defer = true;
            document.head.appendChild(el);
        },
        crisp: (id) => {
            const el = document.createElement('script');
            el.setAttribute('data-chatbot-inject', '1');
            el.textContent = `window.$crisp=[];window.CRISP_WEBSITE_ID="${id}";(function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`;
            document.head.appendChild(el);
        },
        tawk: (id) => {
            const el = document.createElement('script');
            el.setAttribute('data-chatbot-inject', '1');
            el.textContent = `var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s=document.createElement("script");s.async=true;s.src="https://embed.tawk.to/${id}/default";s.charset="UTF-8";s.setAttribute("crossorigin","*");document.head.appendChild(s);})();`;
            document.head.appendChild(el);
        },
        tidio: (id) => {
            const el = document.createElement('script');
            el.src = `https://code.tidio.co/${id}.js`;
            el.setAttribute('data-chatbot-inject', '1');
            el.async = true;
            document.head.appendChild(el);
        },
    };

    const injector = PROVIDERS[provider];
    if (!injector) {
        console.warn(`CleanSchedule: unknown chatbot provider "${provider}".`);
        return;
    }

    injector(widgetId);
}
