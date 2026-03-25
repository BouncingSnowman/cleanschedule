/**
 * CleanSchedule — Main Entry Point
 */

import { initCalendar, renderCalendar, renderUnscheduledPanel } from './calendar.js';
import { initEmployees, renderEmployees } from './employees.js';
import { initCustomers, renderCustomers } from './customers.js';
import { initDashboard, renderDashboard } from './dashboard.js';
import { exportData, importData } from './store.js';

document.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    initEmployees();
    initCustomers();
    initDashboard();

    // --- View Navigation ---
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');

    function switchView(viewId) {
        navBtns.forEach(b => b.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));

        const btn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
        const view = document.getElementById(`view-${viewId}`);
        if (btn) btn.classList.add('active');
        if (view) view.classList.add('active');

        // Re-render the active view
        switch (viewId) {
            case 'dashboard': renderDashboard(); break;
            case 'schedule': renderCalendar(); renderUnscheduledPanel(); break;
            case 'employees': renderEmployees(); break;
            case 'customers': renderCustomers(); break;
        }

        // Close mobile menu
        closeMobileMenu();
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
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
        try {
            await importData(file);
            showToast('Data importerad! ✅');
            switchView(getCurrentView());
        } catch (err) {
            showToast('⚠️ ' + err.message);
        }
        importInput.value = '';
    });

    document.getElementById('btn-print').addEventListener('click', () => {
        // Switch to schedule view before printing
        switchView('schedule');
        setTimeout(() => window.print(), 300);
    });

    // --- Mobile Menu ---
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('mobile-menu-btn');

    function openMobileMenu() {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    }

    function closeMobileMenu() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    if (menuBtn) menuBtn.addEventListener('click', openMobileMenu);
    if (overlay) overlay.addEventListener('click', closeMobileMenu);

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

    // --- Sidebar action buttons close mobile menu ---
    document.querySelectorAll('.sidebar-action-btn').forEach(btn => {
        // already handled above
    });

    // Start on dashboard
    renderDashboard();
});

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
