/**
 * CleanSchedule — Dashboard / Overview (Enhanced with Charts)
 */

import {
    getEmployees, getCustomers, getJobs, getUnscheduledJobs,
    getJobOccurrencesForWeek, EMPLOYEE_COLORS
} from './store.js?v=19';

export function initDashboard() {
    // Dashboard re-renders when navigated to
}

export function renderDashboard() {
    const container = document.getElementById('dashboard-content');
    const employees = getEmployees();
    const customers = getCustomers();
    const jobs = getJobs();
    const unscheduled = getUnscheduledJobs();

    // Get current week start (Monday)
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(now);
    weekStart.setDate(mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const occurrences = getJobOccurrencesForWeek(weekStartStr);

    // --- Stats ---
    const totalJobsThisWeek = occurrences.length;
    const totalHoursThisWeek = occurrences.reduce((sum, j) => sum + (parseFloat(j.hours) || 0), 0);
    const activeEmployees = employees.length;
    const totalCustomers = customers.length;

    // Per-employee stats
    const empStats = employees.map(emp => {
        const colorObj = EMPLOYEE_COLORS.find(c => c.id === emp.color) || EMPLOYEE_COLORS[0];
        const empJobs = occurrences.filter(j => j.employeeId === emp.id);
        const hoursBooked = empJobs.reduce((sum, j) => sum + (parseFloat(j.hours) || 0), 0);
        const hasTarget = emp.type !== 'contractor' || parseFloat(emp.defaultHours) > 0;
        const target = hasTarget ? (parseFloat(emp.defaultHours) || 40) : 0;
        const pct = hasTarget ? Math.min(Math.round((hoursBooked / target) * 100), 100) : 0;
        return { ...emp, hoursBooked, target, pct, hasTarget, jobCount: empJobs.length, colorObj };
    }).filter(e => e.hasTarget || e.hoursBooked > 0);

    // Weekly distribution (jobs per day)
    const dayNames = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
    const dayJobCounts = [];
    const dayHoursCounts = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const ds = d.toISOString().split('T')[0];
        const dayJobs = occurrences.filter(j => j.occurrenceDate === ds);
        dayJobCounts.push(dayJobs.length);
        dayHoursCounts.push(dayJobs.reduce((s, j) => s + (parseFloat(j.hours) || 0), 0));
    }

    // Today's jobs
    const todayStr = now.toISOString().split('T')[0];
    const todayJobs = occurrences.filter(j => j.occurrenceDate === todayStr);

    // Customer distribution (donut chart data)
    const custJobMap = {};
    occurrences.forEach(j => {
        const key = j.customerId || 'unknown';
        custJobMap[key] = (custJobMap[key] || 0) + 1;
    });
    const custSlices = Object.entries(custJobMap).map(([id, count]) => {
        const cust = customers.find(c => c.id === id);
        return { name: cust?.name || 'Okänd', count, id };
    }).sort((a, b) => b.count - a.count);

    // Avg hours per job
    const avgHours = totalJobsThisWeek > 0 ? (totalHoursThisWeek / totalJobsThisWeek).toFixed(1) : '0';

    // --- BUILD HTML ---
    const todayFormatted = formatSwedishDate(now);
    const todayCapitalized = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

    container.innerHTML = `
        <!-- Today's date -->
        <div class="dashboard-date">${todayCapitalized}</div>

        <!-- Stats Cards -->
        <div class="stats-row">
            <div class="stat-card clickable" data-navigate="schedule">
                <div class="stat-icon" style="background: rgba(59,130,246,0.1); color: var(--accent)">📋</div>
                <div class="stat-content">
                    <div class="stat-value">${totalJobsThisWeek}</div>
                    <div class="stat-label">Jobb denna vecka</div>
                </div>
            </div>
            <div class="stat-card clickable" data-navigate="schedule">
                <div class="stat-icon" style="background: rgba(16,185,129,0.1); color: var(--success)">⏱</div>
                <div class="stat-content">
                    <div class="stat-value">${totalHoursThisWeek}h</div>
                    <div class="stat-label">Timmar bokat</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(245,158,11,0.1); color: var(--warning)">⌀</div>
                <div class="stat-content">
                    <div class="stat-value">${avgHours}h</div>
                    <div class="stat-label">Snitt per jobb</div>
                </div>
            </div>
            <div class="stat-card clickable" data-navigate="schedule">
                <div class="stat-icon" style="background: rgba(239,68,68,0.1); color: var(--danger)">📦</div>
                <div class="stat-content">
                    <div class="stat-value">${unscheduled.length}</div>
                    <div class="stat-label">Oplanerade</div>
                </div>
            </div>
        </div>

        <!-- Row 2: Bar Chart + Donut -->
        <div class="dashboard-columns">
            <div class="dash-panel">
                <h2 class="dash-panel-title">Timmar per dag</h2>
                <div class="bar-chart" id="bar-chart-hours">
                    ${renderBarChart(dayNames, dayHoursCounts, 'h')}
                </div>
            </div>

            <div class="dash-panel">
                <h2 class="dash-panel-title">Fördelning per kund</h2>
                <div class="donut-chart-container">
                    ${renderDonutChart(custSlices, totalJobsThisWeek)}
                </div>
            </div>
        </div>

        <!-- Row 3: Utilization + Today -->
        <div class="dashboard-columns" style="margin-top: 20px">
            <!-- Employee Utilization -->
            <div class="dash-panel">
                <h2 class="dash-panel-title">Beläggning per anställd</h2>
                ${empStats.length === 0 ? '<p class="text-muted">Inga anställda tillagda ännu.</p>' :
                empStats.map(e => {
                    const isOver = e.hasTarget && e.hoursBooked > e.target;
                    const barColor = isOver ? '#ef4444' : e.colorObj.color;
                    const hoursStyle = isOver ? 'color:#ef4444;font-weight:600' : '';
                    return `
                    <div class="utilization-row">
                        <div class="util-info">
                            <span class="emp-color-dot" style="background: ${e.colorObj.color}"></span>
                            <span class="util-name">${escHtml(e.name)}</span>
                            <span class="util-hours" style="${hoursStyle}">${e.hoursBooked}h${e.hasTarget ? ` / ${e.target}h` : ''}</span>
                        </div>
                        ${e.hasTarget ? `
                        <div class="util-bar-bg">
                            <div class="util-bar-fill" style="width: ${Math.min(e.pct, 100)}%; background: ${barColor}"></div>
                        </div>
                        <span class="util-pct" style="${isOver ? 'color:#ef4444;font-weight:600' : ''}">${e.pct}%</span>
                        ` : ''}
                    </div>
                `;}).join('')}
            </div>

            <!-- Today's Schedule -->
            <div class="dash-panel">
                <h2 class="dash-panel-title">Idag — ${formatSwedishDate(now)}</h2>
                ${todayJobs.length === 0 ? '<p class="text-muted">Inga jobb schemalagda idag.</p>' :
                todayJobs.map(j => {
                    const emp = employees.find(e => e.id === j.employeeId);
                    const empColor = emp ? (EMPLOYEE_COLORS.find(c => c.id === emp.color) || EMPLOYEE_COLORS[0]) : EMPLOYEE_COLORS[0];
                    const custName = j.customerId ? (customers.find(c => c.id === j.customerId)?.name || 'Okänd') : 'Okänd';
                    return `
                        <div class="today-job" style="border-left: 3px solid ${empColor.color}; background: ${empColor.bg}">
                            <div class="today-job-customer">${escHtml(custName)}</div>
                            <div class="today-job-meta">
                                ${emp ? escHtml(emp.name) : '—'} · ${j.startTime || ''} · ${j.hours || '?'}h
                            </div>
                        </div>
                    `;
                }).join('')}

                <!-- Summary stats -->
                <div class="today-summary" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-light)">
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-secondary)">
                        <span>👥 ${employees.length} anställda</span>
                        <span>🏠 ${customers.length} kunder</span>
                        <span>📋 ${jobs.length} totalt jobb</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Bind clickable stat cards to navigate to schedule view
    container.querySelectorAll('.stat-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            const view = card.dataset.navigate;
            if (view && window._switchView) window._switchView(view);
        });
    });
}

// --- SVG Bar Chart ---
function renderBarChart(labels, values, unit) {
    const maxVal = Math.max(...values, 1);
    const barWidth = 32;
    const gap = 16;
    const chartWidth = labels.length * (barWidth + gap);
    const topPad = 24;
    const bottomPad = 24;
    const chartHeight = 160 + topPad;

    const bars = labels.map((label, i) => {
        const v = values[i] || 0;
        const barH = Math.max((v / maxVal) * (chartHeight - bottomPad - topPad - 10), 2);
        const x = i * (barWidth + gap) + gap / 2;
        const y = chartHeight - bottomPad - barH;
        const colors = ['#3b82f6', '#60a5fa', '#3b82f6', '#60a5fa', '#3b82f6', '#93c5fd'];
        return `
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${colors[i]}" opacity="0.85">
                <animate attributeName="height" from="0" to="${barH}" dur="0.5s" fill="freeze"/>
                <animate attributeName="y" from="${chartHeight - bottomPad}" to="${y}" dur="0.5s" fill="freeze"/>
            </rect>
            <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-secondary)">${v}${unit}</text>
            <text x="${x + barWidth / 2}" y="${chartHeight - 6}" text-anchor="middle" font-size="11" fill="var(--text-muted)">${label}</text>
        `;
    }).join('');

    return `<svg viewBox="0 0 ${chartWidth} ${chartHeight}" class="chart-svg">${bars}</svg>`;
}

// --- SVG Donut Chart ---
function renderDonutChart(slices, total) {
    if (total === 0 || slices.length === 0) {
        return `
            <div style="text-align:center; padding: 20px; color:var(--text-muted)">
                <p>Inga jobb denna vecka</p>
            </div>`;
    }

    const cx = 70, cy = 70, r = 55, strokeW = 18;
    const circumference = 2 * Math.PI * r;
    const donutColors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#a78bfa', '#f472b6', '#34d399', '#fb923c'];

    let currentAngle = 0;
    const arcs = slices.map((slice, i) => {
        const pct = slice.count / total;
        const dashLen = pct * circumference;
        const dashGap = circumference - dashLen;
        const offset = -currentAngle * circumference + circumference * 0.25;
        currentAngle += pct;
        const color = donutColors[i % donutColors.length];
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeW}"
            stroke-dasharray="${dashLen} ${dashGap}" stroke-dashoffset="${offset}"
            style="transition: stroke-dashoffset 0.5s ease"/>`;
    }).join('');

    const legend = slices.map((s, i) => `
        <div class="donut-legend-item">
            <span class="donut-legend-dot" style="background: ${donutColors[i % donutColors.length]}"></span>
            <span class="donut-legend-label">${escHtml(s.name)}</span>
            <span class="donut-legend-value">${s.count} jobb</span>
        </div>
    `).join('');

    return `
        <div class="donut-layout">
            <div class="donut-svg-wrap">
                <svg viewBox="0 0 ${cx * 2} ${cy * 2}" class="donut-svg">
                    ${arcs}
                    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="22" font-weight="700" fill="var(--text-primary)">${total}</text>
                    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="11" fill="var(--text-muted)">Totalt</text>
                </svg>
            </div>
            <div class="donut-legend">${legend}</div>
        </div>`;
}

function formatSwedishDate(d) {
    const days = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
    const months = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
        'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
