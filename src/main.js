/**
 * CleanSchedule — Main Entry Point (with Auth)
 */

import { restoreSession, isLoggedIn, signOut, handleOAuthCallback, getUser, resolveUserRole, isAdmin, isEmployee, getUserRole, dbGetSetting } from './supabase.js?v=72';
import { initAuth, renderAuthView, renderAccessDenied } from './auth.js?v=72';
import { loadAllData, getUnscheduledJobs } from './store.js?v=72';
import { initCalendar, renderCalendar, renderUnscheduledPanel } from './calendar.js?v=72';
import { initEmployees, renderEmployees } from './employees.js?v=72';
import { initCustomers, renderCustomers } from './customers.js?v=72';
import { initDashboard, renderDashboard } from './dashboard.js?v=72';
import { initSettings, renderSettings, injectChatbotScript } from './settings.js?v=72';
import { initMySchedule, renderMySchedule } from './my-schedule.js?v=72';
import { exportData, importData, importCustomersFromCsv } from './store.js?v=72';

const APP_VERSION = '1.0.72';

document.addEventListener('DOMContentLoaded', async () => {
    initAuth(onLoginSuccess);

    // Check for OAuth callback (Google redirect)
    if (handleOAuthCallback() && isLoggedIn()) {
        await onLoginSuccess();
        return;
    }

    // Try to restore session
    if (restoreSession() && isLoggedIn()) {
        await onLoginSuccess();
    } else {
        showAuthView();
    }
});

async function onLoginSuccess() {
    // Load all data from Supabase
    const loadingEl = document.getElementById('loading-overlay');
    if (loadingEl) loadingEl.classList.remove('hidden');

    // Resolve role (admin/employee) from database
    const role = await resolveUserRole();
    if (!role) {
        if (loadingEl) loadingEl.classList.add('hidden');
        // Show Access Denied screen — do NOT auto-sign-out
        const user = getUser();
        document.getElementById('view-auth').classList.remove('hidden');
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('main-content').classList.add('hidden');
        renderAccessDenied(user?.email, async () => {
            // Retry: try resolving role again
            await onLoginSuccess();
        });
        return;
    }

    await loadAllData();

    if (loadingEl) loadingEl.classList.add('hidden');

    // Hide auth, show app
    document.getElementById('view-auth').classList.add('hidden');
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden');

    // Role-based sidebar: employees see only Mitt Schema + Inställningar + Logga ut
    if (isEmployee()) {
        document.getElementById('nav-dashboard')?.parentElement?.classList.add('hidden');
        document.getElementById('nav-schedule')?.parentElement?.classList.add('hidden');
        document.getElementById('nav-unscheduled-item')?.classList.add('hidden');
        document.getElementById('nav-employees')?.parentElement?.classList.add('hidden');
        document.getElementById('nav-customers')?.parentElement?.classList.add('hidden');
        document.getElementById('btn-export')?.classList.add('hidden');
        document.getElementById('btn-import')?.classList.add('hidden');
        document.getElementById('btn-print')?.classList.add('hidden');
    }

    // Init modules
    initCalendar();
    initEmployees();
    initCustomers();
    initDashboard();
    initSettings();
    initMySchedule();

    // Inject saved chatbot script — load from DB (source of truth), fallback to local cache
    try {
        const dbScript = await dbGetSetting('chatbot_script');
        if (dbScript) {
            localStorage.setItem('cs_chatbot_script', dbScript); // refresh cache
            injectChatbotScript(dbScript);
        } else {
            // Fallback to local cache if DB has nothing (offline / first load)
            const cached = localStorage.getItem('cs_chatbot_script');
            if (cached) injectChatbotScript(cached);
        }
    } catch {
        const cached = localStorage.getItem('cs_chatbot_script');
        if (cached) injectChatbotScript(cached);
    }

    // Show user info in sidebar (avatar + email + version)
    const user = getUser();
    const userName = document.querySelector('.user-name');
    if (userName && user?.email) userName.textContent = user.email;

    // Google avatar
    const avatarEl = document.querySelector('.user-avatar');
    if (avatarEl && user?.avatar_url) {
        const img = document.createElement('img');
        img.src = user.avatar_url;
        img.className = 'user-avatar-img';
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        avatarEl.replaceChildren(img);
    }

    // Version display
    const versionEl = document.getElementById('app-version');
    if (versionEl) {
        versionEl.textContent = `v${APP_VERSION}`;
        versionEl.title = 'Klicka för att kopiera version';
        versionEl.style.cursor = 'pointer';
        versionEl.addEventListener('click', () => {
            navigator.clipboard?.writeText(`CleanSchedule v${APP_VERSION}`);
            versionEl.textContent = 'Kopierad!';
            setTimeout(() => { versionEl.textContent = `v${APP_VERSION}`; }, 1500);
        });
    }

    // --- View Navigation ---
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view:not(#view-auth)');

    // Update sidebar unscheduled nav item visibility
    function updateUnscheduledNav() {
        const jobs = getUnscheduledJobs();
        const item = document.getElementById('nav-unscheduled-item');
        const badge = document.getElementById('nav-unscheduled-badge');
        if (item && badge) {
            if (jobs.length > 0) {
                item.classList.remove('hidden');
                badge.textContent = jobs.length;
            } else {
                item.classList.add('hidden');
            }
        }
    }

    window._switchView = function switchView(viewId) {
        navBtns.forEach(b => b.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));

        const btn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
        const view = document.getElementById(`view-${viewId}`);
        if (btn) btn.classList.add('active');
        if (view) view.classList.add('active');

        switch (viewId) {
            case 'dashboard': renderDashboard(); break;
            case 'schedule': renderCalendar(); renderUnscheduledPanel(); break;
            case 'employees': renderEmployees(); break;
            case 'customers': renderCustomers(); break;
            case 'my-schedule': renderMySchedule(); break;
            case 'settings': renderSettings(); break;
        }
        updateUnscheduledNav();
        closeMobileMenu();
    };

    // "Oplanerade" sidebar link: switch to schedule AND expand panel
    document.getElementById('nav-unscheduled')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window._switchView('schedule');
        const panel = document.getElementById('unscheduled-panel');
        if (panel) panel.classList.remove('collapsed');
    });

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => window._switchView(btn.dataset.view));
    });

    // --- Export / Import / Print ---
    document.getElementById('btn-export').addEventListener('click', () => {
        exportData();
        showToast('Data exporterad! ✅');
        closeMobileMenu();
    });

    const importInput = document.getElementById('import-file-input');
    document.getElementById('btn-import').addEventListener('click', () => {
        importInput.click();
        closeMobileMenu();
    });

    importInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!confirm('Importera data? All befintlig data ersätts med filens innehåll.')) {
            importInput.value = '';
            return;
        }
        try {
            await importData(file);
            showToast('Data importerad! ✅');
            window._switchView(getCurrentView());
        } catch (err) {
            showToast('⚠️ ' + err.message);
        }
        importInput.value = '';
    });

    // --- CSV Import (Spiris) ---
    const csvInput = document.getElementById('csv-file-input');
    document.getElementById('btn-import-csv').addEventListener('click', () => {
        csvInput.click();
    });

    csvInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!confirm('Importera kunder fr\u00e5n Spiris CSV? Befintliga kunder beh\u00e5lls.')) {
            csvInput.value = '';
            return;
        }
        try {
            const count = await importCustomersFromCsv(file);
            showToast(`${count} kunder importerade! \u2705`);
            window._switchView('customers');
        } catch (err) {
            showToast('\u26a0\ufe0f ' + err.message);
        }
        csvInput.value = '';
    });

    document.getElementById('btn-print').addEventListener('click', () => {
        window._switchView('schedule');
        setTimeout(() => window.print(), 300);
    });

    // --- Logout ---
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut();
            location.reload();
        });
    }

    // --- Dark mode toggle ---
    const themeBtn = document.getElementById('btn-theme');
    const themeIcon = document.getElementById('theme-icon');
    const themeLabel = document.getElementById('theme-label');

    function applyTheme(dark) {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        themeIcon.textContent = dark ? '☀️' : '🌙';
        themeLabel.textContent = dark ? 'Ljust läge' : 'Mörkt läge';
        localStorage.setItem('cs_theme', dark ? 'dark' : 'light');
    }

    // Restore saved theme (default: dark)
    const savedTheme = localStorage.getItem('cs_theme');
    applyTheme(savedTheme !== 'light');

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            applyTheme(!isDark);
        });
    }

    // --- Sidebar Collapse (desktop/tablet) ---
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (collapseBtn) {
        if (localStorage.getItem('cs_sidebar') === 'collapsed') {
            document.body.classList.add('sidebar-collapsed');
        }
        collapseBtn.addEventListener('click', () => {
            const collapsed = document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem('cs_sidebar', collapsed ? 'collapsed' : 'open');
        });
    }

    // --- Unscheduled Panel Collapse ---
    const panelToggle = document.getElementById('btn-toggle-panel');
    if (panelToggle) {
        if (localStorage.getItem('cs_panel') === 'collapsed') {
            document.body.classList.add('panel-collapsed');
        }
        panelToggle.addEventListener('click', () => {
            const collapsed = document.body.classList.toggle('panel-collapsed');
            localStorage.setItem('cs_panel', collapsed ? 'collapsed' : 'open');
            // Flip arrow direction
            panelToggle.querySelector('svg').style.transform = collapsed ? 'rotate(180deg)' : '';
        });
        // Set initial arrow
        if (document.body.classList.contains('panel-collapsed')) {
            panelToggle.querySelector('svg').style.transform = 'rotate(180deg)';
        }
    }

    // --- Mobile Menu ---
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('mobile-menu-btn');

    if (menuBtn) menuBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    });
    if (overlay) overlay.addEventListener('click', closeMobileMenu);

    function closeMobileMenu() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    // --- Customer Search ---
    const searchInput = document.getElementById('customer-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderCustomers(searchInput.value.trim());
        });
    }

    function getCurrentView() {
        const active = document.querySelector('.nav-btn.active');
        return active?.dataset.view || 'dashboard';
    }

    // Start on appropriate view
    if (isEmployee()) {
        window._switchView('my-schedule');
    } else {
        renderDashboard();
        updateUnscheduledNav();
    }

    // --- Auto-refresh when tab becomes visible (sync changes from other users) ---
    let lastRefresh = Date.now();
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 5000) {
            lastRefresh = Date.now();
            await loadAllData();
            const current = getCurrentView();
            switch (current) {
                case 'schedule': renderCalendar(); renderUnscheduledPanel(); break;
                case 'dashboard': renderDashboard(); break;
                case 'my-schedule': renderMySchedule(); break;
            }
            updateUnscheduledNav();
        }
    });
}

function showAuthView(errorMsg) {
    document.getElementById('view-auth').classList.remove('hidden');
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
    renderAuthView(errorMsg);
}

// --- Toast helper ---
function showToast(message) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toast-message');
    msg.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hidden');
    }, 3000);
}
