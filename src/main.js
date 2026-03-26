/**
 * CleanSchedule — Main Entry Point (with Auth)
 */

import { restoreSession, isLoggedIn, signOut, handleOAuthCallback, getUser } from './supabase.js?v=22';
import { initAuth, renderAuthView } from './auth.js?v=22';
import { loadAllData, getUnscheduledJobs } from './store.js?v=22';
import { initCalendar, renderCalendar, renderUnscheduledPanel } from './calendar.js?v=22';
import { initEmployees, renderEmployees } from './employees.js?v=22';
import { initCustomers, renderCustomers } from './customers.js?v=22';
import { initDashboard, renderDashboard } from './dashboard.js?v=22';
import { initSettings, renderSettings } from './settings.js?v=22';
import { exportData, importData, importCustomersFromCsv } from './store.js?v=22';

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

    await loadAllData();

    if (loadingEl) loadingEl.classList.add('hidden');

    // Hide auth, show app
    document.getElementById('view-auth').classList.add('hidden');
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden');

    // Init modules
    initCalendar();
    initEmployees();
    initCustomers();
    initDashboard();

    // Show user email in sidebar
    const user = getUser();
    const userName = document.querySelector('.user-name');
    if (userName && user?.email) userName.textContent = user.email;

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

    // Restore saved theme
    const savedTheme = localStorage.getItem('cs_theme');
    if (savedTheme === 'dark') applyTheme(true);

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

    // Start on dashboard
    renderDashboard();
    updateUnscheduledNav();
}

function showAuthView() {
    document.getElementById('view-auth').classList.remove('hidden');
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
    renderAuthView();
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
