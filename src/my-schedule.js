/**
 * CleanSchedule — "Mitt Schema" (My Schedule)
 * Employee self-service view — shows only their own jobs.
 */

import {
    getEmployees, getCustomers, getEmployee, getCustomer,
    getJobOccurrencesForWeek, getTimeOffForEmployee,
    isEmployeeOffOnDate, EMPLOYEE_COLORS, toLocalDateStr
} from './store.js?v=72';
import { getUser } from './supabase.js?v=72';
import { downloadWeekIcs } from './ics.js?v=72';

const DAYS_SV = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const MONTHS_SV = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
    'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

let currentWeekStart = null;
let myEmployeeId = null;

export function initMySchedule() {
    currentWeekStart = getMonday(new Date());
    resolveMyEmployeeId();

    document.getElementById('my-btn-prev-week')?.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderMySchedule();
    });

    document.getElementById('my-btn-next-week')?.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderMySchedule();
    });

    document.getElementById('my-btn-today')?.addEventListener('click', () => {
        currentWeekStart = getMonday(new Date());
        renderMySchedule();
    });

    document.getElementById('my-btn-export')?.addEventListener('click', () => {
        if (!myEmployeeId) return;
        const emp = getEmployee(myEmployeeId);
        const weekStartStr = formatDate(currentWeekStart);
        const occurrences = getJobOccurrencesForWeek(weekStartStr);
        const customers = getCustomers();
        const reminderMin = parseInt(localStorage.getItem('cs_reminder_minutes') || '0', 10) || null;
        const weekNum = getWeekNumber(currentWeekStart);
        const ok = downloadWeekIcs(occurrences, customers, emp, reminderMin, `v${weekNum}`);
        if (!ok) alert('Inga jobb att exportera denna vecka.');
    });

    renderMySchedule();
}

function resolveMyEmployeeId() {
    const user = getUser();
    if (!user?.email) return;
    const emp = getEmployees().find(e => e.email?.toLowerCase() === user.email.toLowerCase());
    myEmployeeId = emp?.id || null;
}

export function renderMySchedule() {
    const container = document.getElementById('my-schedule-content');
    if (!container) return;

    resolveMyEmployeeId();

    if (!myEmployeeId) {
        container.innerHTML = `
            <div class="empty-state" style="min-height: 400px;">
                <div class="empty-state-icon">🔗</div>
                <h3>Ingen koppling hittad</h3>
                <p>Ditt konto (${escHtml(getUser()?.email || '')}) kunde inte matchas mot en anställd. Kontakta din chef.</p>
            </div>`;
        return;
    }

    const emp = getEmployee(myEmployeeId);
    const colorObj = EMPLOYEE_COLORS.find(c => c.id === emp?.color) || EMPLOYEE_COLORS[0];
    const weekStartStr = formatDate(currentWeekStart);
    const allOccurrences = getJobOccurrencesForWeek(weekStartStr);
    const myJobs = allOccurrences.filter(j => j.employeeId === myEmployeeId);
    const timeOff = getTimeOffForEmployee(myEmployeeId);

    // Week title
    updateMyWeekTitle();

    // Get dates for each day
    const dayDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        dayDates.push(d);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today);

    // Build day cards
    let html = '<div class="my-schedule-days">';

    for (let i = 0; i < 7; i++) {
        const d = dayDates[i];
        const dateStr = formatDate(d);
        const isToday = d.getTime() === today.getTime();
        const isPast = d < today;
        const isOff = isEmployeeOffOnDate(myEmployeeId, dateStr);
        const dayJobs = myJobs.filter(j => j.occurrenceDate === dateStr);
        const dayHours = dayJobs.reduce((s, j) => s + parseHours(j.hours), 0);

        html += `<div class="my-day-card ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${isOff ? 'day-off' : ''}">`;

        // Day header
        html += `<div class="my-day-header" style="border-left: 4px solid ${colorObj.color}">
            <div class="my-day-name">${DAYS_SV[i]}</div>
            <div class="my-day-date">${d.getDate()} ${MONTHS_SV[d.getMonth()]}</div>
            ${isToday ? '<span class="my-today-badge">Idag</span>' : ''}
            ${isOff ? '<span class="my-off-badge">Ledig</span>' : ''}
            ${dayHours > 0 ? `<span class="my-hours-badge">${fmtHours(dayHours)}h</span>` : ''}
        </div>`;

        if (dayJobs.length === 0 && !isOff) {
            html += `<div class="my-day-empty">Inga jobb</div>`;
        }

        for (const job of dayJobs) {
            const customer = getCustomer(job.customerId);
            const custName = customer?.name || 'Okänd kund';
            const custAddr = customer?.address || '';
            const cancelledClass = job.isCancelled ? ' my-job-cancelled' : '';

            html += `<div class="my-job-card${cancelledClass}" style="border-left: 4px solid ${job.isCancelled ? 'var(--text-muted)' : colorObj.color}; background: ${job.isCancelled ? 'var(--bg-hover)' : colorObj.bg}">
                ${job.isCancelled ? '<div class="my-job-cancelled-badge">🚫 Inställd</div>' : ''}
                <div class="my-job-customer">${escHtml(custName)}</div>
                ${custAddr ? `<div class="my-job-address">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${escHtml(custAddr)}
                </div>` : ''}
                <div class="my-job-meta">
                    ${job.startTime ? `<span class="my-job-time">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${job.startTime}
                    </span>` : ''}
                    ${job.hours ? `<span class="my-job-hours">${fmtHours(job.hours)}h</span>` : ''}
                    ${(job.isRecurring || (job.recurring && job.recurring !== 'none')) ? '<span class="my-job-recurring">🔄 Återkommande</span>' : ''}
                </div>
                ${job.notes ? `<div class="my-job-notes">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <em>${escHtml(job.notes)}</em>
                </div>` : ''}
            </div>`;
        }

        html += `</div>`;
    }

    html += '</div>';

    // Week summary (exclude cancelled)
    const activeJobs = myJobs.filter(j => !j.isCancelled);
    const totalJobs = activeJobs.length;
    const totalHours = activeJobs.reduce((s, j) => s + parseHours(j.hours), 0);

    html += `<div class="my-week-summary">
        <div class="my-summary-stat">
            <span class="my-summary-value">${totalJobs}</span>
            <span class="my-summary-label">jobb denna vecka</span>
        </div>
        <div class="my-summary-stat">
            <span class="my-summary-value">${fmtHours(totalHours)}h</span>
            <span class="my-summary-label">totalt timmar</span>
        </div>
    </div>`;

    container.innerHTML = html;
}

function updateMyWeekTitle() {
    const titleEl = document.getElementById('my-week-title');
    if (!titleEl) return;

    const weekNum = getWeekNumber(currentWeekStart);
    const endDate = new Date(currentWeekStart);
    endDate.setDate(endDate.getDate() + 6);

    const startMonth = MONTHS_SV[currentWeekStart.getMonth()];
    const endMonth = MONTHS_SV[endDate.getMonth()];

    let dateRange;
    if (currentWeekStart.getMonth() === endDate.getMonth()) {
        dateRange = `${currentWeekStart.getDate()}–${endDate.getDate()} ${startMonth}`;
    } else {
        dateRange = `${currentWeekStart.getDate()} ${startMonth} – ${endDate.getDate()} ${endMonth}`;
    }

    titleEl.textContent = `Vecka ${weekNum} — ${dateRange}`;
}

// --- Helpers ---

function parseHours(val) {
    if (!val && val !== 0) return 0;
    return parseFloat(String(val).replace(',', '.')) || 0;
}

function fmtHours(val) {
    const n = typeof val === 'number' ? val : parseHours(val);
    const s = String(parseFloat(n.toFixed(2)));
    return s.replace('.', ',');
}

function getMonday(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
