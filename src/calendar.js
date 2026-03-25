/**
 * CleanSchedule — Weekly Calendar View
 */

import {
    getEmployees, getCustomers, getEmployee, getCustomer,
    getJobOccurrencesForWeek, getUnscheduledJobs, addJob, updateJob, deleteJob,
    EMPLOYEE_COLORS, isEmployeeOffOnDate
} from './store.js';
import { openModal, closeModal } from './modals.js';

const DAYS_SV = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
const MONTHS_SV = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
    'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

let currentWeekStart = null; // Monday of the current displayed week

export function initCalendar() {
    currentWeekStart = getMonday(new Date());

    document.getElementById('btn-prev-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderCalendar();
    });

    document.getElementById('btn-next-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderCalendar();
    });

    document.getElementById('btn-today').addEventListener('click', () => {
        currentWeekStart = getMonday(new Date());
        renderCalendar();
    });

    document.getElementById('btn-add-job').addEventListener('click', () => {
        showJobForm();
    });

    document.getElementById('btn-add-unscheduled').addEventListener('click', () => {
        showUnscheduledForm();
    });

    document.getElementById('unscheduled-search').addEventListener('input', (e) => {
        renderUnscheduledPanel(e.target.value.trim());
    });

    renderCalendar();
    renderUnscheduledPanel();
}

export function renderCalendar() {
    updateWeekTitle();
    const grid = document.getElementById('schedule-grid');
    const employees = getEmployees();
    const weekStartStr = formatDate(currentWeekStart);
    const occurrences = getJobOccurrencesForWeek(weekStartStr);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get dates for each day column
    const dayDates = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        dayDates.push(d);
    }

    if (employees.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; min-height: 400px;">
                <div class="empty-state-icon">📅</div>
                <h3>Lägg till anställda först</h3>
                <p>Gå till "Anställda" i menyn och lägg till dina medarbetare för att se schemat här.</p>
            </div>
        `;
        return;
    }

    let html = '';

    // Header row
    html += '<div class="grid-header">';
    html += '<div class="grid-header-cell">Anställd</div>';
    for (let i = 0; i < 6; i++) {
        const d = dayDates[i];
        const isToday = d.getTime() === today.getTime();
        html += `<div class="grid-header-cell ${isToday ? 'today' : ''}">
            ${DAYS_SV[i]}
            <span class="grid-day-date">${d.getDate()}</span>
        </div>`;
    }
    html += '</div>';

    // Employee rows
    for (const emp of employees) {
        const colorObj = EMPLOYEE_COLORS.find(c => c.id === emp.color) || EMPLOYEE_COLORS[0];

        // Calculate weekly hours for this employee
        const empJobs = occurrences.filter(j => j.employeeId === emp.id);
        const weeklyHours = empJobs.reduce((sum, j) => sum + (parseFloat(j.hours) || 0), 0);

        html += '<div class="grid-row">';

        // Employee name cell
        html += `<div class="grid-employee-cell">
            <span class="emp-color-dot" style="background: ${colorObj.color}"></span>
            <div class="emp-info">
                <span class="emp-name">${escHtml(emp.name)}</span>
                <span class="emp-type">${emp.type === 'fulltime' ? 'Heltid' : 'Tim'}</span>
                <span class="emp-hours">${weeklyHours}h${emp.defaultHours ? ' / ' + emp.defaultHours + 'h' : ''}</span>
            </div>
        </div>`;

        // Day cells
        for (let i = 0; i < 6; i++) {
            const d = dayDates[i];
            const dateStr = formatDate(d);
            const isToday = d.getTime() === today.getTime();
            const dayJobs = occurrences.filter(j =>
                j.employeeId === emp.id && j.occurrenceDate === dateStr
            );

            html += `<div class="grid-day-cell ${isToday ? 'today' : ''} ${isEmployeeOffOnDate(emp.id, dateStr) ? 'day-off' : ''}" 
                          data-employee="${emp.id}" 
                          data-date="${dateStr}">`;

            if (isEmployeeOffOnDate(emp.id, dateStr)) {
                html += `<div class="off-badge">Ledig</div>`;
            }
            for (const job of dayJobs) {
                const customer = getCustomer(job.customerId);
                const custName = customer ? customer.name : 'Okänd kund';
                html += `<div class="job-block" 
                              style="background: ${colorObj.bg}; border-color: ${colorObj.color}"
                              data-job-id="${job.id}"
                              title="${escHtml(custName)}${job.hours ? ' — ' + job.hours + 'h' : ''}">
                    <div class="job-customer">${escHtml(custName)}</div>
                    <div class="job-time">
                        ${job.startTime || ''}${job.hours ? ' · ' + job.hours + 'h' : ''}
                        ${job.isRecurring ? '<span class="recurring-badge">🔄</span>' : ''}
                    </div>
                </div>`;
            }

            html += `<div class="add-job-hint">+ Lägg till</div>`;
            html += '</div>';
        }

        html += '</div>';
    }

    grid.innerHTML = html;

    // --- Drag & Drop State ---
    let dragState = null; // { jobId, ghost, originCell }

    function startDrag(e, block) {
        e.preventDefault();
        const jobId = block.dataset.jobId;

        // Create ghost clone
        const rect = block.getBoundingClientRect();
        const ghost = block.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.style.width = rect.width + 'px';
        ghost.style.left = (e.clientX - rect.width / 2) + 'px';
        ghost.style.top = (e.clientY - 10) + 'px';
        document.body.appendChild(ghost);

        block.classList.add('dragging');

        dragState = { jobId, ghost, originBlock: block };

        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
    }

    function onDragMove(e) {
        if (!dragState) return;
        dragState.ghost.style.left = (e.clientX - dragState.ghost.offsetWidth / 2) + 'px';
        dragState.ghost.style.top = (e.clientY - 10) + 'px';

        // Highlight target cell
        grid.querySelectorAll('.grid-day-cell.drag-over').forEach(c => c.classList.remove('drag-over'));
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const cell = target?.closest('.grid-day-cell');
        if (cell) cell.classList.add('drag-over');
    }

    function onDragEnd(e) {
        if (!dragState) return;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);

        // Clean up
        dragState.ghost.remove();
        dragState.originBlock.classList.remove('dragging');
        grid.querySelectorAll('.grid-day-cell.drag-over').forEach(c => c.classList.remove('drag-over'));

        // Find drop target
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const cell = target?.closest('.grid-day-cell');

        if (cell) {
            const newEmployeeId = cell.dataset.employee;
            const newDate = cell.dataset.date;
            if (newEmployeeId && newDate) {
                updateJob(dragState.jobId, { employeeId: newEmployeeId, date: newDate });
                renderCalendar();
            }
        }

        dragState = null;
    }

    // Bind cell click → add job
    grid.querySelectorAll('.grid-day-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
            if (e.target.closest('.job-block')) return;
            showJobForm(null, cell.dataset.employee, cell.dataset.date);
        });
    });

    // Bind job block: click → edit, mousedown → drag
    grid.querySelectorAll('.job-block').forEach(block => {
        let mouseDownTime = 0;

        block.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            mouseDownTime = Date.now();
            // Start drag after a tiny delay to distinguish from click
            const startX = e.clientX;
            const startY = e.clientY;

            function onFirstMove(me) {
                const dx = me.clientX - startX;
                const dy = me.clientY - startY;
                if (Math.abs(dx) + Math.abs(dy) > 5) {
                    document.removeEventListener('mousemove', onFirstMove);
                    document.removeEventListener('mouseup', onFirstUp);
                    startDrag(me, block);
                }
            }

            function onFirstUp() {
                document.removeEventListener('mousemove', onFirstMove);
                document.removeEventListener('mouseup', onFirstUp);
            }

            document.addEventListener('mousemove', onFirstMove);
            document.addEventListener('mouseup', onFirstUp);
        });

        block.addEventListener('click', (e) => {
            e.stopPropagation();
            // Only open edit if it was a quick click (not a drag)
            if (Date.now() - mouseDownTime < 300) {
                const jobId = block.dataset.jobId;
                const job = occurrences.find(j => j.id === jobId);
                if (job) showJobForm(job);
            }
        });
    });
}

function showJobForm(existing = null, prefillEmployee = '', prefillDate = '') {
    const isEdit = !!existing;
    const employees = getEmployees();
    const customers = getCustomers();

    if (employees.length === 0 || customers.length === 0) {
        openModal({
            title: 'Kan inte skapa jobb',
            body: `<p>Du behöver lägga till minst en anställd och en kund innan du kan schemalägga jobb.</p>`,
            footer: `<button class="btn-primary" id="modal-cancel">OK</button>`,
        });
        document.getElementById('modal-cancel').addEventListener('click', closeModal);
        return;
    }

    const empOptions = employees.map(e =>
        `<option value="${e.id}" ${(existing?.employeeId || prefillEmployee) === e.id ? 'selected' : ''}>${escHtml(e.name)}</option>`
    ).join('');

    const custOptions = customers.map(c =>
        `<option value="${c.id}" ${existing?.customerId === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`
    ).join('');

    const dateValue = existing?.date || prefillDate || formatDate(new Date());

    openModal({
        title: isEdit ? 'Redigera jobb' : 'Nytt jobb',
        body: `
            <div class="form-row">
                <div class="form-group">
                    <label for="job-employee">Anställd *</label>
                    <select id="job-employee" class="form-input">${empOptions}</select>
                </div>
                <div class="form-group">
                    <label for="job-customer">Kund *</label>
                    <select id="job-customer" class="form-input">${custOptions}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="job-date">Datum *</label>
                    <input type="date" id="job-date" class="form-input" value="${dateValue}">
                </div>
                <div class="form-group">
                    <label for="job-start">Starttid</label>
                    <input type="time" id="job-start" class="form-input" value="${existing?.startTime || '08:00'}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="job-hours">Antal timmar</label>
                    <input type="number" id="job-hours" class="form-input" placeholder="3" step="0.5" min="0.5" value="${existing?.hours || ''}">
                </div>
                <div class="form-group">
                    <label for="job-recurring">Återkommande</label>
                    <select id="job-recurring" class="form-input">
                        <option value="none" ${(!existing?.recurring || existing?.recurring === 'none') ? 'selected' : ''}>Nej</option>
                        <option value="weekly" ${existing?.recurring === 'weekly' ? 'selected' : ''}>Varje vecka</option>
                        <option value="biweekly" ${existing?.recurring === 'biweekly' ? 'selected' : ''}>Varannan vecka</option>
                        <option value="monthly" ${existing?.recurring === 'monthly' ? 'selected' : ''}>Varje månad</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label for="job-notes">Anteckningar</label>
                <textarea id="job-notes" class="form-input" placeholder="Särskilda instruktioner...">${existing?.notes || ''}</textarea>
            </div>
        `,
        footer: `
            ${isEdit ? '<button class="btn-danger" id="modal-delete">Ta bort</button>' : ''}
            <div style="flex:1"></div>
            <button class="btn-ghost" id="modal-cancel">Avbryt</button>
            <button class="btn-primary" id="modal-save">${isEdit ? 'Spara' : 'Lägg till'}</button>
        `,
    });

    // Auto-fill hours from customer estimate when customer changes
    const custSelect = document.getElementById('job-customer');
    const hoursInput = document.getElementById('job-hours');
    custSelect.addEventListener('change', () => {
        if (!hoursInput.value) {
            const cust = customers.find(c => c.id === custSelect.value);
            if (cust?.estimatedHours) hoursInput.value = cust.estimatedHours;
        }
    });
    // Trigger once on open if no hours set
    if (!existing && !hoursInput.value) {
        const cust = customers.find(c => c.id === custSelect.value);
        if (cust?.estimatedHours) hoursInput.value = cust.estimatedHours;
    }

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    if (isEdit) {
        document.getElementById('modal-delete').addEventListener('click', () => {
            if (confirm('Är du säker på att du vill ta bort detta jobb?')) {
                deleteJob(existing.id);
                closeModal();
                renderCalendar();
            }
        });
    }

    document.getElementById('modal-save').addEventListener('click', () => {
        const jobData = {
            employeeId: document.getElementById('job-employee').value,
            customerId: document.getElementById('job-customer').value,
            date: document.getElementById('job-date').value,
            startTime: document.getElementById('job-start').value,
            hours: document.getElementById('job-hours').value,
            recurring: document.getElementById('job-recurring').value,
            notes: document.getElementById('job-notes').value.trim(),
        };

        if (!jobData.date) {
            document.getElementById('job-date').style.borderColor = 'var(--danger)';
            return;
        }

        if (isEdit) {
            updateJob(existing.id, jobData);
        } else {
            addJob(jobData);
        }

        closeModal();
        renderCalendar();
        renderUnscheduledPanel();
    });
}

// --- Unscheduled Jobs Panel ---

export function renderUnscheduledPanel(filter = '') {
    const container = document.getElementById('unscheduled-list');
    const badge = document.getElementById('unscheduled-count');
    const customers = getCustomers();
    let jobs = getUnscheduledJobs();

    badge.textContent = jobs.length;
    badge.dataset.count = jobs.length;

    if (filter) {
        const q = filter.toLowerCase();
        jobs = jobs.filter(j => {
            const cust = getCustomer(j.customerId);
            return (cust?.name || '').toLowerCase().includes(q) ||
                   (cust?.address || '').toLowerCase().includes(q) ||
                   (j.notes || '').toLowerCase().includes(q);
        });
    }

    if (jobs.length === 0 && !filter) {
        container.innerHTML = `
            <div class="unscheduled-empty">
                <p>✨ Inga oplanerade jobb</p>
            </div>`;
        return;
    }

    if (jobs.length === 0 && filter) {
        container.innerHTML = `<div class="unscheduled-empty"><p>🔍 Inga träffar</p></div>`;
        return;
    }

    container.innerHTML = jobs.map(job => {
        const cust = getCustomer(job.customerId);
        const custName = cust ? cust.name : 'Okänd kund';
        const custAddr = cust?.address || '';
        const hours = job.hours || '?';

        return `
            <div class="unscheduled-card" data-job-id="${job.id}">
                <div class="drag-handle">
                    <span class="drag-handle-dot"></span>
                    <span class="drag-handle-dot"></span>
                    <span class="drag-handle-dot"></span>
                    <span class="drag-handle-dot"></span>
                    <span class="drag-handle-dot"></span>
                    <span class="drag-handle-dot"></span>
                </div>
                <div class="unscheduled-card-content">
                    <div class="card-customer">${escHtml(custName)}</div>
                    <div class="card-type">Städning</div>
                    <div class="card-meta">
                        <span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            ${hours}h
                        </span>
                        ${custAddr ? `<span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            ${escHtml(custAddr)}
                        </span>` : ''}
                    </div>
                </div>
            </div>`;
    }).join('');

    // Bind drag from panel to calendar
    const grid = document.getElementById('schedule-grid');

    container.querySelectorAll('.unscheduled-card').forEach(card => {
        card.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const startX = e.clientX;
            const startY = e.clientY;

            function onFirstMove(me) {
                const dx = me.clientX - startX;
                const dy = me.clientY - startY;
                if (Math.abs(dx) + Math.abs(dy) > 5) {
                    document.removeEventListener('mousemove', onFirstMove);
                    document.removeEventListener('mouseup', onFirstUp);
                    startPanelDrag(me, card, grid);
                }
            }

            function onFirstUp() {
                document.removeEventListener('mousemove', onFirstMove);
                document.removeEventListener('mouseup', onFirstUp);
            }

            document.addEventListener('mousemove', onFirstMove);
            document.addEventListener('mouseup', onFirstUp);
        });
    });
}

function startPanelDrag(e, card, grid) {
    e.preventDefault();
    const jobId = card.dataset.jobId;

    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.width = rect.width + 'px';
    ghost.style.left = (e.clientX - rect.width / 2) + 'px';
    ghost.style.top = (e.clientY - 10) + 'px';
    document.body.appendChild(ghost);

    card.classList.add('dragging');

    function onMove(me) {
        ghost.style.left = (me.clientX - ghost.offsetWidth / 2) + 'px';
        ghost.style.top = (me.clientY - 10) + 'px';

        grid.querySelectorAll('.grid-day-cell.drag-over').forEach(c => c.classList.remove('drag-over'));
        const target = document.elementFromPoint(me.clientX, me.clientY);
        const cell = target?.closest('.grid-day-cell');
        if (cell) cell.classList.add('drag-over');
    }

    function onUp(me) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        ghost.remove();
        card.classList.remove('dragging');
        grid.querySelectorAll('.grid-day-cell.drag-over').forEach(c => c.classList.remove('drag-over'));

        const target = document.elementFromPoint(me.clientX, me.clientY);
        const cell = target?.closest('.grid-day-cell');

        if (cell) {
            const newEmployeeId = cell.dataset.employee;
            const newDate = cell.dataset.date;
            if (newEmployeeId && newDate) {
                updateJob(jobId, { employeeId: newEmployeeId, date: newDate });
                renderCalendar();
                renderUnscheduledPanel();
            }
        }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function showUnscheduledForm() {
    const customers = getCustomers();

    if (customers.length === 0) {
        openModal({
            title: 'Kan inte skapa jobb',
            body: `<p>Du behöver lägga till minst en kund först.</p>`,
            footer: `<button class="btn-primary" id="modal-cancel">OK</button>`,
        });
        document.getElementById('modal-cancel').addEventListener('click', closeModal);
        return;
    }

    const custOptions = customers.map(c =>
        `<option value="${c.id}">${escHtml(c.name)}</option>`
    ).join('');

    openModal({
        title: 'Nytt oplanerat jobb',
        body: `
            <div class="form-group">
                <label for="unsched-customer">Kund *</label>
                <select id="unsched-customer" class="form-input">${custOptions}</select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="unsched-hours">Antal timmar</label>
                    <input type="number" id="unsched-hours" class="form-input" placeholder="3" step="0.5" min="0.5">
                </div>
                <div class="form-group">
                    <label for="unsched-start">Starttid</label>
                    <input type="time" id="unsched-start" class="form-input" value="08:00">
                </div>
            </div>
            <div class="form-group">
                <label for="unsched-notes">Anteckningar</label>
                <textarea id="unsched-notes" class="form-input" placeholder="Särskilda instruktioner..."></textarea>
            </div>
        `,
        footer: `
            <button class="btn-ghost" id="modal-cancel">Avbryt</button>
            <button class="btn-primary" id="modal-save">Lägg till</button>
        `,
    });

    // Auto-fill hours from customer
    const custSelect = document.getElementById('unsched-customer');
    const hoursInput = document.getElementById('unsched-hours');
    custSelect.addEventListener('change', () => {
        const cust = customers.find(c => c.id === custSelect.value);
        if (cust?.estimatedHours && !hoursInput.value) hoursInput.value = cust.estimatedHours;
    });
    // Trigger on open
    const firstCust = customers.find(c => c.id === custSelect.value);
    if (firstCust?.estimatedHours) hoursInput.value = firstCust.estimatedHours;

    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', () => {
        const jobData = {
            customerId: custSelect.value,
            hours: hoursInput.value,
            startTime: document.getElementById('unsched-start').value,
            notes: document.getElementById('unsched-notes').value.trim(),
            employeeId: '',  // Unassigned!
            date: '',        // Unscheduled!
            recurring: 'none',
        };

        addJob(jobData);
        closeModal();
        renderUnscheduledPanel();
    });
}

function updateWeekTitle() {
    const titleEl = document.getElementById('week-title');
    const weekNum = getWeekNumber(currentWeekStart);

    const endDate = new Date(currentWeekStart);
    endDate.setDate(endDate.getDate() + 5); // Saturday

    const startMonth = MONTHS_SV[currentWeekStart.getMonth()];
    const endMonth = MONTHS_SV[endDate.getMonth()];

    let dateRange;
    if (currentWeekStart.getMonth() === endDate.getMonth()) {
        dateRange = `${currentWeekStart.getDate()}–${endDate.getDate()} ${startMonth} ${currentWeekStart.getFullYear()}`;
    } else {
        dateRange = `${currentWeekStart.getDate()} ${startMonth} – ${endDate.getDate()} ${endMonth} ${endDate.getFullYear()}`;
    }

    titleEl.textContent = `Vecka ${weekNum} — ${dateRange}`;
}

// --- Helper Functions ---

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
    div.textContent = str;
    return div.innerHTML;
}
