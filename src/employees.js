/**
 * CleanSchedule — Employee Management UI
 */

import { getEmployees, addEmployee, updateEmployee, deleteEmployee, EMPLOYEE_COLORS, getTimeOffForEmployee, addTimeOff, deleteTimeOff, toLocalDateStr } from './store.js?v=29';
import { openModal, closeModal } from './modals.js?v=29';

let onChangeCallback = null;

export function initEmployees(onChange) {
    onChangeCallback = onChange;
    document.getElementById('btn-add-employee').addEventListener('click', () => showEmployeeForm());
    renderEmployees();
}

export function renderEmployees() {
    const container = document.getElementById('employees-list');
    const employees = getEmployees();

    if (employees.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1">
                <div class="empty-state-icon">👥</div>
                <h3>Inga anställda ännu</h3>
                <p>Lägg till dina anställda för att börja schemalägga jobb.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = employees.map(emp => {
        const colorObj = EMPLOYEE_COLORS.find(c => c.id === emp.color) || EMPLOYEE_COLORS[0];
        return `
            <div class="card" data-id="${emp.id}">
                <div class="card-header">
                    <div class="card-title">
                        <span class="emp-color-dot" style="background: ${colorObj.color}; width: 12px; height: 12px;"></span>
                        ${escHtml(emp.name)}
                    </div>
                    <span class="card-badge ${emp.type === 'fulltime' ? 'badge-fulltime' : 'badge-contractor'}">
                        ${emp.type === 'fulltime' ? 'Heltid' : 'Timanställd'}
                    </span>
                </div>
                ${emp.phone ? `
                <div class="card-detail">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    ${escHtml(emp.phone)}
                </div>` : ''}
                ${emp.email ? `
                <div class="card-detail">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    ${escHtml(emp.email)}
                </div>` : ''}
                ${emp.defaultHours ? `
                <div class="card-detail">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${escHtml(emp.defaultHours)} tim/vecka
                </div>` : ''}
                ${emp.notes ? `
                <div class="card-detail" style="font-style:italic;color:var(--text-secondary)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    <em>${escHtml(emp.notes)}</em>
                </div>` : ''}
                <div class="card-actions">
                    <button class="btn-ghost btn-edit-emp" data-id="${emp.id}">Redigera</button>
                    <button class="btn-ghost btn-timeoff-emp" data-id="${emp.id}">🚫 Ledighet</button>
                    <button class="btn-danger btn-delete-emp" data-id="${emp.id}">Ta bort</button>
                </div>
            </div>
        `;
    }).join('');

    // Bind events
    container.querySelectorAll('.btn-edit-emp').forEach(btn => {
        btn.addEventListener('click', () => {
            const emp = getEmployees().find(e => e.id === btn.dataset.id);
            if (emp) showEmployeeForm(emp);
        });
    });

    container.querySelectorAll('.btn-delete-emp').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('Är du säker på att du vill ta bort denna anställd? Alla deras jobb tas också bort.')) {
                await deleteEmployee(btn.dataset.id);
                renderEmployees();
                if (onChangeCallback) onChangeCallback();
            }
        });
    });

    container.querySelectorAll('.btn-timeoff-emp').forEach(btn => {
        btn.addEventListener('click', () => {
            const emp = getEmployees().find(e => e.id === btn.dataset.id);
            if (emp) showTimeOffForm(emp);
        });
    });
}

function showEmployeeForm(existing = null) {
    const isEdit = !!existing;
    const colors = EMPLOYEE_COLORS;
    const selectedColor = existing ? existing.color : colors[0].id;

    const colorSwatches = colors.map(c => `
        <div class="color-swatch ${c.id === selectedColor ? 'selected' : ''}" 
             data-color="${c.id}" 
             style="background: ${c.color}"
             title="${c.id}"></div>
    `).join('');

    openModal({
        title: isEdit ? 'Redigera anställd' : 'Lägg till anställd',
        body: `
            <div class="form-group">
                <label for="emp-name">Namn *</label>
                <input type="text" id="emp-name" class="form-input" placeholder="T.ex. Cajsa" value="${existing ? escHtml(existing.name) : ''}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="emp-type">Typ</label>
                    <select id="emp-type" class="form-input">
                        <option value="fulltime" ${existing?.type === 'fulltime' ? 'selected' : ''}>Heltid</option>
                        <option value="contractor" ${existing?.type === 'contractor' ? 'selected' : ''}>Timanställd</option>
                    </select>
                </div>
                <div class="form-group" id="emp-hours-group" style="${existing?.type === 'contractor' ? 'display:none' : ''}">
                    <label for="emp-hours">Tim/vecka</label>
                    <input type="number" id="emp-hours" class="form-input" placeholder="40" value="${existing?.defaultHours || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="emp-phone">Telefon</label>
                    <input type="tel" id="emp-phone" class="form-input" placeholder="070-123 4567" value="${existing?.phone || ''}">
                </div>
                <div class="form-group">
                    <label for="emp-email">E-post</label>
                    <input type="email" id="emp-email" class="form-input" placeholder="namn@exempel.se" value="${existing?.email || ''}">
                </div>
            </div>
            <div class="form-group">
                <label for="emp-notes">Anteckningar</label>
                <textarea id="emp-notes" class="form-input" placeholder="T.ex. körkort, allergier, tillgänglighet...">${existing?.notes || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Färg</label>
                <div class="color-picker" id="color-picker">
                    ${colorSwatches}
                </div>
            </div>
        `,
        footer: `
            <button class="btn-ghost" id="modal-cancel">Avbryt</button>
            <button class="btn-primary" id="modal-save">${isEdit ? 'Spara' : 'Lägg till'}</button>
        `,
    });

    // Color picker logic
    let chosenColor = selectedColor;
    document.getElementById('color-picker').addEventListener('click', (e) => {
        const swatch = e.target.closest('.color-swatch');
        if (!swatch) return;
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        chosenColor = swatch.dataset.color;
    });

    // Type change — show/hide hours field
    document.getElementById('emp-type').addEventListener('change', (e) => {
        const hoursGroup = document.getElementById('emp-hours-group');
        if (e.target.value === 'contractor') {
            hoursGroup.style.display = 'none';
            document.getElementById('emp-hours').value = '';
        } else {
            hoursGroup.style.display = '';
        }
    });

    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', async () => {
        const name = document.getElementById('emp-name').value.trim();
        if (!name) {
            document.getElementById('emp-name').style.borderColor = 'var(--danger)';
            return;
        }

        const empData = {
            name,
            type: document.getElementById('emp-type').value,
            defaultHours: document.getElementById('emp-type').value === 'contractor' ? '' : (document.getElementById('emp-hours').value || ''),
            phone: document.getElementById('emp-phone').value.trim(),
            email: document.getElementById('emp-email').value.trim(),
            color: chosenColor,
            notes: document.getElementById('emp-notes').value.trim(),
        };

        try {
            if (isEdit) {
                await updateEmployee(existing.id, empData);
            } else {
                await addEmployee(empData);
            }
            closeModal();
            renderEmployees();
            if (onChangeCallback) onChangeCallback();
        } catch (err) {
            alert('Kunde inte spara: ' + err.message);
        }
    });
}

function showTimeOffForm(emp) {
    const entries = getTimeOffForEmployee(emp.id);
    const today = toLocalDateStr(new Date());

    const entriesHtml = entries.length === 0
        ? '<p style="color:var(--text-muted); font-size:0.85rem">Ingen ledighet registrerad.</p>'
        : entries.map(t => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-light)">
                <div>
                    <strong>${t.startDate}</strong> — <strong>${t.endDate}</strong>
                    ${t.reason ? `<br><span style="font-size:0.8rem;color:var(--text-muted)">${escHtml(t.reason)}</span>` : ''}
                </div>
                <button class="btn-danger btn-rm-timeoff" data-id="${t.id}" style="padding:4px 10px; font-size:0.75rem">✕</button>
            </div>
        `).join('');

    openModal({
        title: `Ledighet — ${escHtml(emp.name)}`,
        body: `
            <div id="timeoff-list" style="margin-bottom:16px">${entriesHtml}</div>
            <hr style="border:none;border-top:1px solid var(--border-light);margin:16px 0">
            <h3 style="font-size:0.9rem;font-weight:600;margin-bottom:12px">Registrera ny ledighet</h3>
            <div class="form-row">
                <div class="form-group">
                    <label for="to-start">Startdatum *</label>
                    <input type="date" id="to-start" class="form-input" value="${today}">
                </div>
                <div class="form-group">
                    <label for="to-end">Slutdatum *</label>
                    <input type="date" id="to-end" class="form-input" value="${today}">
                </div>
            </div>
            <div class="form-group">
                <label for="to-reason">Anledning</label>
                <input type="text" id="to-reason" class="form-input" placeholder="T.ex. semester, sjuk, VAB...">
            </div>
        `,
        footer: `
            <button class="btn-ghost" id="modal-cancel">Stäng</button>
            <button class="btn-primary" id="modal-save">Lägg till ledighet</button>
        `,
    });

    // Remove entries
    document.querySelectorAll('.btn-rm-timeoff').forEach(btn => {
        btn.addEventListener('click', async () => {
            await deleteTimeOff(btn.dataset.id);
            showTimeOffForm(emp); // Re-open to refresh list
        });
    });

    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', async () => {
        const startDate = document.getElementById('to-start').value;
        const endDate = document.getElementById('to-end').value;
        const reason = document.getElementById('to-reason').value.trim();

        if (!startDate || !endDate) return;
        if (endDate < startDate) {
            document.getElementById('to-end').style.borderColor = 'var(--danger)';
            return;
        }

        await addTimeOff({ employeeId: emp.id, startDate, endDate, reason });
        showTimeOffForm(emp); // Re-open to refresh list
    });
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
