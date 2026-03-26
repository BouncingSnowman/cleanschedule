/**
 * CleanSchedule — Customer Management UI
 */

import { getCustomers, addCustomer, updateCustomer, deleteCustomer, getJobs, getEmployees, EMPLOYEE_COLORS } from './store.js?v=26';
import { openModal, closeModal } from './modals.js?v=26';

let onChangeCallback = null;

export function initCustomers(onChange) {
    onChangeCallback = onChange;
    document.getElementById('btn-add-customer').addEventListener('click', () => showCustomerForm());
    renderCustomers();
}

export function renderCustomers(filter = '') {
    const container = document.getElementById('customers-list');
    let customers = getCustomers();

    // Apply search filter
    if (filter) {
        const q = filter.toLowerCase();
        customers = customers.filter(c =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.address || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q) ||
            (c.notes || '').toLowerCase().includes(q)
        );
    }

    if (customers.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1">
                <div class="empty-state-icon">${filter ? '🔍' : '🏠'}</div>
                <h3>${filter ? 'Inga kunder hittades' : 'Inga kunder ännu'}</h3>
                <p>${filter ? 'Prova ett annat sökord.' : 'Lägg till dina kunder för att börja schemalägga städjobb.'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = customers.map(cust => {
        const custJobs = getJobs().filter(j => j.customerId === cust.id);
        const employees = getEmployees();
        const jobsHtml = custJobs.length > 0 ? `
            <div class="card-jobs">
                <div class="card-jobs-title">📋 Planerade jobb (${custJobs.length})</div>
                ${custJobs.map(j => {
                    const emp = employees.find(e => e.id === j.employeeId);
                    const colorObj = emp ? (EMPLOYEE_COLORS.find(c => c.id === emp.color) || EMPLOYEE_COLORS[0]) : null;
                    const empName = emp ? escHtml(emp.name) : '<span style="color:var(--text-muted)">Ej tilldelad</span>';
                    const schedule = j.recurring
                        ? `🔄 Återkommande · ${j.hours || '?'}h`
                        : `${j.date || '?'} · ${j.hours || '?'}h`;
                    return `
                        <div class="card-job-item">
                            ${colorObj ? `<span class="emp-color-dot" style="background:${colorObj.color};width:8px;height:8px"></span>` : ''}
                            <span class="card-job-emp">${empName}</span>
                            <span class="card-job-schedule">${schedule}</span>
                        </div>`;
                }).join('')}
            </div>` : '';

        return `
        <div class="card" data-id="${cust.id}">
            <div class="card-header">
                <div class="card-title">${escHtml(cust.name)}</div>
            </div>
            ${cust.address ? `
            <div class="card-detail">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                ${escHtml(cust.address)}
            </div>` : ''}
            ${cust.phone ? `
            <div class="card-detail">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                ${escHtml(cust.phone)}
            </div>` : ''}
            ${cust.email ? `
            <div class="card-detail">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                ${escHtml(cust.email)}
            </div>` : ''}
            ${cust.notes ? `
            <div class="card-detail">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <em>${escHtml(cust.notes)}</em>
            </div>` : ''}
            ${jobsHtml}
            <div class="card-actions">
                <button class="btn-ghost btn-edit-cust" data-id="${cust.id}">Redigera</button>
                <button class="btn-danger btn-delete-cust" data-id="${cust.id}">Ta bort</button>
            </div>
        </div>
    `;}).join('');

    // Bind events
    container.querySelectorAll('.btn-edit-cust').forEach(btn => {
        btn.addEventListener('click', () => {
            const cust = getCustomers().find(c => c.id === btn.dataset.id);
            if (cust) showCustomerForm(cust);
        });
    });

    container.querySelectorAll('.btn-delete-cust').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('Är du säker på att du vill ta bort denna kund? Alla deras jobb tas också bort.')) {
                await deleteCustomer(btn.dataset.id);
                renderCustomers();
                if (onChangeCallback) onChangeCallback();
            }
        });
    });
}

function showCustomerForm(existing = null) {
    const isEdit = !!existing;

    openModal({
        title: isEdit ? 'Redigera kund' : 'Lägg till kund',
        body: `
            <div class="form-group">
                <label for="cust-name">Namn *</label>
                <input type="text" id="cust-name" class="form-input" placeholder="T.ex. Familjen Andersson" value="${existing ? escHtml(existing.name) : ''}" required>
            </div>
            <div class="form-group">
                <label for="cust-address">Adress</label>
                <input type="text" id="cust-address" class="form-input" placeholder="Storgatan 12, 123 45 Stockholm" value="${existing?.address || ''}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="cust-phone">Telefon</label>
                    <input type="tel" id="cust-phone" class="form-input" placeholder="070-123 4567" value="${existing?.phone || ''}">
                </div>
                <div class="form-group">
                    <label for="cust-email">E-post</label>
                    <input type="email" id="cust-email" class="form-input" placeholder="namn@exempel.se" value="${existing?.email || ''}">
                </div>
            </div>
            <div class="form-group">
                <label for="cust-notes">Anteckningar</label>
                <textarea id="cust-notes" class="form-input" placeholder="T.ex. portkod, husdjur, specialinstruktioner...">${existing?.notes || ''}</textarea>
            </div>
            <div class="form-group">
                <label for="cust-est-hours">Uppskattat antal timmar</label>
                <input type="number" id="cust-est-hours" class="form-input" placeholder="3" step="0.5" min="0.5" value="${existing?.estimatedHours || ''}">
            </div>
        `,
        footer: `
            <button class="btn-ghost" id="modal-cancel">Avbryt</button>
            <button class="btn-primary" id="modal-save">${isEdit ? 'Spara' : 'Lägg till'}</button>
        `,
    });

    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', async () => {
        const name = document.getElementById('cust-name').value.trim();
        if (!name) {
            document.getElementById('cust-name').style.borderColor = 'var(--danger)';
            return;
        }

        const custData = {
            name,
            address: document.getElementById('cust-address').value.trim(),
            phone: document.getElementById('cust-phone').value.trim(),
            email: document.getElementById('cust-email').value.trim(),
            notes: document.getElementById('cust-notes').value.trim(),
            estimatedHours: document.getElementById('cust-est-hours').value || '',
        };

        try {
            if (isEdit) {
                await updateCustomer(existing.id, custData);
            } else {
                await addCustomer(custData);
            }
            closeModal();
            renderCustomers();
            if (onChangeCallback) onChangeCallback();
        } catch (err) {
            alert('Kunde inte spara: ' + err.message);
        }
    });
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
