/**
 * CleanSchedule — Data Store (Supabase Backend)
 * In-memory cache + Supabase sync for fast reads.
 * All write operations persist to Supabase and update local cache.
 */

import { dbSelect, dbInsert, dbUpdate, dbDelete, isLoggedIn } from './supabase.js?v=16';

const SUPABASE_URL = 'https://cywcnyimlhiwbbqqzvoe.supabase.co';

/** Fire-and-forget push notification via Edge Function */
async function sendPush(type, employeeEmail, title, body) {
    try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, employee_email: employeeEmail, title, body }),
        });
    } catch (e) {
        console.warn('Push notification failed (non-blocking):', e);
    }
}

const EMPLOYEE_COLORS = [
    { id: 'coral',   color: '#f87171', bg: '#fef2f2' },
    { id: 'teal',    color: '#2dd4bf', bg: '#f0fdfa' },
    { id: 'purple',  color: '#a78bfa', bg: '#f5f3ff' },
    { id: 'amber',   color: '#fbbf24', bg: '#fffbeb' },
    { id: 'green',   color: '#34d399', bg: '#ecfdf5' },
    { id: 'blue',    color: '#60a5fa', bg: '#eff6ff' },
    { id: 'pink',    color: '#f472b6', bg: '#fdf2f8' },
    { id: 'orange',  color: '#fb923c', bg: '#fff7ed' },
];

// --- In-memory cache ---
let _cache = {
    employees: [],
    customers: [],
    jobs: [],
    timeOff: [],
    loaded: false,
};

/** Load all data from Supabase into cache */
export async function loadAllData() {
    if (!isLoggedIn()) return;
    try {
        const [employees, customers, jobs, timeOff] = await Promise.all([
            dbSelect('employees', 'order=created_at.asc'),
            dbSelect('customers', 'order=created_at.asc'),
            dbSelect('jobs', 'order=created_at.asc'),
            dbSelect('time_off', 'order=created_at.asc'),
        ]);
        _cache.employees = mapFromDb(employees, 'employee');
        _cache.customers = mapFromDb(customers, 'customer');
        _cache.jobs = mapFromDb(jobs, 'job');
        _cache.timeOff = mapFromDb(timeOff, 'timeOff');
        _cache.loaded = true;
    } catch (e) {
        console.error('Failed to load data:', e);
    }
}

// Map DB snake_case to JS camelCase
function mapFromDb(rows, type) {
    return rows.map(r => {
        if (type === 'employee') return {
            id: r.id, name: r.name, phone: r.phone, email: r.email,
            type: r.type, color: r.color,
            defaultHours: r.default_hours, notes: r.notes,
        };
        if (type === 'customer') return {
            id: r.id, name: r.name, address: r.address,
            phone: r.phone, email: r.email,
            estimatedHours: r.estimated_hours, notes: r.notes,
        };
        if (type === 'job') return {
            id: r.id, customerId: r.customer_id, employeeId: r.employee_id,
            date: r.date, startTime: r.start_time, hours: r.hours,
            recurring: r.recurring, notes: r.notes,
        };
        if (type === 'timeOff') return {
            id: r.id, employeeId: r.employee_id,
            startDate: r.start_date, endDate: r.end_date, reason: r.reason,
        };
        return r;
    });
}

// Map JS camelCase to DB snake_case
function toDbEmployee(e) {
    const r = {};
    if (e.name !== undefined) r.name = e.name;
    if (e.phone !== undefined) r.phone = e.phone;
    if (e.email !== undefined) r.email = e.email;
    if (e.type !== undefined) r.type = e.type;
    if (e.color !== undefined) r.color = e.color;
    if (e.defaultHours !== undefined) r.default_hours = e.defaultHours === '' ? null : e.defaultHours;
    if (e.notes !== undefined) r.notes = e.notes;
    return r;
}

function toDbCustomer(c) {
    const r = {};
    if (c.name !== undefined) r.name = c.name;
    if (c.address !== undefined) r.address = c.address;
    if (c.phone !== undefined) r.phone = c.phone;
    if (c.email !== undefined) r.email = c.email;
    if (c.estimatedHours !== undefined) r.estimated_hours = c.estimatedHours === '' ? null : c.estimatedHours;
    if (c.notes !== undefined) r.notes = c.notes;
    return r;
}

function toDbJob(j) {
    const r = {};
    if (j.customerId !== undefined) r.customer_id = j.customerId;
    if (j.employeeId !== undefined) r.employee_id = j.employeeId || null;
    if (j.date !== undefined) r.date = j.date || null;
    if (j.startTime !== undefined) r.start_time = j.startTime;
    if (j.hours !== undefined) r.hours = j.hours;
    if (j.recurring !== undefined) r.recurring = j.recurring;
    if (j.notes !== undefined) r.notes = j.notes;
    return r;
}

function toDbTimeOff(t) {
    const r = {};
    if (t.employeeId !== undefined) r.employee_id = t.employeeId;
    if (t.startDate !== undefined) r.start_date = t.startDate;
    if (t.endDate !== undefined) r.end_date = t.endDate;
    if (t.reason !== undefined) r.reason = t.reason;
    return r;
}

// --- Employees (sync reads from cache, async writes to Supabase) ---

export function getEmployees() {
    return _cache.employees;
}

export function getEmployee(id) {
    return _cache.employees.find(e => e.id === id);
}

export async function addEmployee(employee) {
    const rows = await dbInsert('employees', toDbEmployee(employee));
    const added = mapFromDb(rows, 'employee')[0];
    _cache.employees.push(added);
    return added;
}

export async function updateEmployee(id, updates) {
    const rows = await dbUpdate('employees', id, toDbEmployee(updates));
    const updated = mapFromDb(rows, 'employee')[0];
    const idx = _cache.employees.findIndex(e => e.id === id);
    if (idx !== -1) _cache.employees[idx] = updated;
    return updated;
}

export async function deleteEmployee(id) {
    await dbDelete('employees', id);
    _cache.employees = _cache.employees.filter(e => e.id !== id);
    _cache.jobs = _cache.jobs.filter(j => j.employeeId !== id);
    _cache.timeOff = _cache.timeOff.filter(t => t.employeeId !== id);
}

// --- Customers ---

export function getCustomers() {
    return _cache.customers;
}

export function getCustomer(id) {
    return _cache.customers.find(c => c.id === id);
}

export async function addCustomer(customer) {
    const rows = await dbInsert('customers', toDbCustomer(customer));
    const added = mapFromDb(rows, 'customer')[0];
    _cache.customers.push(added);
    return added;
}

export async function updateCustomer(id, updates) {
    const rows = await dbUpdate('customers', id, toDbCustomer(updates));
    const updated = mapFromDb(rows, 'customer')[0];
    const idx = _cache.customers.findIndex(c => c.id === id);
    if (idx !== -1) _cache.customers[idx] = updated;
    return updated;
}

export async function deleteCustomer(id) {
    await dbDelete('customers', id);
    _cache.customers = _cache.customers.filter(c => c.id !== id);
    _cache.jobs = _cache.jobs.filter(j => j.customerId !== id);
}

// --- Jobs ---

export function getJobs() {
    return _cache.jobs;
}

export function getJobOccurrencesForWeek(weekStart) {
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const occurrences = [];

    for (const job of _cache.jobs) {
        if (!job.date || !job.employeeId) continue; // skip unscheduled

        const jobDate = new Date(job.date);

        // Direct match
        if (jobDate >= start && jobDate <= end) {
            occurrences.push({ ...job, occurrenceDate: job.date });
            continue;
        }

        // Recurring
        if (job.recurring && job.recurring !== 'none') {
            const dayOfWeek = jobDate.getDay();
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                if (d.getDay() === dayOfWeek && d > jobDate) {
                    let match = false;
                    const targetDate = new Date(d);

                    if (job.recurring === 'weekly') match = true;
                    if (job.recurring === 'biweekly') {
                        const diffWeeks = Math.round((targetDate - jobDate) / (7 * 24 * 60 * 60 * 1000));
                        match = diffWeeks % 2 === 0;
                    }
                    if (job.recurring === 'monthly') {
                        match = targetDate.getDate() === jobDate.getDate();
                    }

                    if (match) {
                        const dateStr = targetDate.toISOString().split('T')[0];
                        occurrences.push({ ...job, occurrenceDate: dateStr, isRecurring: true });
                    }
                }
            }
        }
    }

    return occurrences;
}

export function getUnscheduledJobs() {
    return _cache.jobs.filter(j => !j.employeeId || !j.date);
}

export async function addJob(job) {
    const rows = await dbInsert('jobs', toDbJob(job));
    const added = mapFromDb(rows, 'job')[0];
    _cache.jobs.push(added);

    // Send push notification
    if (added.employeeId && added.date) {
        // Assigned job → notify employee
        const emp = getEmployee(added.employeeId);
        const cust = getCustomer(added.customerId);
        if (emp?.email) {
            sendPush(
                'assigned',
                emp.email,
                'Nytt jobb tilldelat',
                `${cust?.name || 'Okänd kund'} — ${added.date}${added.startTime ? ' kl ' + added.startTime : ''}`
            );
        }
    } else if (!added.employeeId || !added.date) {
        // Unscheduled job → notify all
        const cust = getCustomer(added.customerId);
        // Send to all allowed emails
        sendPush(
            'unscheduled',
            'ingeholberg@gmail.com',
            'Nytt oplanerat jobb',
            `${cust?.name || 'Okänd kund'} behöver schemaläggas`
        );
    }

    return added;
}

export async function updateJob(id, updates) {
    const rows = await dbUpdate('jobs', id, toDbJob(updates));
    const updated = mapFromDb(rows, 'job')[0];
    const idx = _cache.jobs.findIndex(j => j.id === id);
    if (idx !== -1) _cache.jobs[idx] = updated;
    return updated;
}

export async function deleteJob(id) {
    await dbDelete('jobs', id);
    _cache.jobs = _cache.jobs.filter(j => j.id !== id);
}

// --- Time Off ---

export function getTimeOff() {
    return _cache.timeOff;
}

export function getTimeOffForEmployee(employeeId) {
    return _cache.timeOff.filter(t => t.employeeId === employeeId);
}

export async function addTimeOff(entry) {
    const rows = await dbInsert('time_off', toDbTimeOff(entry));
    const added = mapFromDb(rows, 'timeOff')[0];
    _cache.timeOff.push(added);
    return added;
}

export async function deleteTimeOff(id) {
    await dbDelete('time_off', id);
    _cache.timeOff = _cache.timeOff.filter(t => t.id !== id);
}

export function isEmployeeOffOnDate(employeeId, dateStr) {
    const d = new Date(dateStr);
    return _cache.timeOff.some(t => {
        if (t.employeeId !== employeeId) return false;
        const start = new Date(t.startDate);
        const end = new Date(t.endDate);
        return d >= start && d <= end;
    });
}

// --- Export/Import ---

export function exportData() {
    const data = {
        employees: _cache.employees,
        customers: _cache.customers,
        jobs: _cache.jobs,
        timeOff: _cache.timeOff,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleanschedule-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function importData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.employees || !data.customers || !data.jobs) {
                    reject(new Error('Ogiltig fil'));
                    return;
                }

                // Clear existing data first to avoid duplicates
                for (const t of _cache.timeOff) await dbDelete('time_off', t.id);
                for (const j of _cache.jobs) await dbDelete('jobs', j.id);
                for (const c of _cache.customers) await dbDelete('customers', c.id);
                for (const emp of _cache.employees) await dbDelete('employees', emp.id);
                _cache = { employees: [], customers: [], jobs: [], timeOff: [], loaded: true };

                // Import with ID mapping (old ID → new ID)
                const empIdMap = {};
                const custIdMap = {};

                for (const emp of data.employees) {
                    const oldId = emp.id;
                    const added = await addEmployee(emp);
                    empIdMap[oldId] = added.id;
                }
                for (const cust of data.customers) {
                    const oldId = cust.id;
                    const added = await addCustomer(cust);
                    custIdMap[oldId] = added.id;
                }
                for (const job of data.jobs) {
                    const mapped = { ...job };
                    if (mapped.employeeId) mapped.employeeId = empIdMap[mapped.employeeId] || mapped.employeeId;
                    if (mapped.customerId) mapped.customerId = custIdMap[mapped.customerId] || mapped.customerId;
                    delete mapped.id;
                    await addJob(mapped);
                }
                for (const to of (data.timeOff || [])) {
                    const mapped = { ...to };
                    if (mapped.employeeId) mapped.employeeId = empIdMap[mapped.employeeId] || mapped.employeeId;
                    delete mapped.id;
                    await addTimeOff(mapped);
                }
                resolve(data);
            } catch (err) {
                reject(new Error('Kunde inte importera: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Filläsningsfel'));
        reader.readAsText(file);
    });
}
// --- Spiris Online CSV Import ---

export async function importCustomersFromCsv(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target.result;
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (lines.length < 2) { reject(new Error('Tom CSV-fil')); return; }

                // Parse header
                const headers = lines[0].split(';');
                const col = (name) => headers.indexOf(name);

                const nameIdx = col('Name');
                const activeIdx = col('IsActive');
                const addr1Idx = col('InvoiceAddress1');
                const addr2Idx = col('InvoiceAddress2');
                const postalIdx = col('InvoicePostalCode');
                const cityIdx = col('InvoiceCity');
                const phoneIdx = col('Telephone');
                const mobileIdx = col('MobilePhone');
                const emailIdx = col('EmailAddress');
                const noteIdx = col('Note');

                if (nameIdx === -1) { reject(new Error('Kolumnen "Name" saknas i CSV')); return; }

                // Parse rows
                const customers = [];
                const seenNames = new Set();

                for (let i = 1; i < lines.length; i++) {
                    const fields = lines[i].split(';');
                    
                    // Skip inactive
                    if (activeIdx !== -1 && fields[activeIdx]?.trim().toLowerCase() === 'false') continue;

                    const name = fields[nameIdx]?.trim();
                    if (!name) continue;

                    // Deduplicate by name
                    if (seenNames.has(name.toLowerCase())) continue;
                    seenNames.add(name.toLowerCase());

                    // Build address
                    const parts = [
                        fields[addr1Idx]?.trim(),
                        fields[addr2Idx]?.trim(),
                        [fields[postalIdx]?.trim(), fields[cityIdx]?.trim()].filter(Boolean).join(' ')
                    ].filter(Boolean);

                    const phone = fields[mobileIdx]?.trim() || fields[phoneIdx]?.trim() || '';

                    customers.push({
                        name,
                        address: parts.join(', ') || '',
                        phone,
                        email: fields[emailIdx]?.trim() || '',
                        notes: fields[noteIdx]?.trim() || '',
                        estimatedHours: '',
                    });
                }

                // Insert into Supabase
                let count = 0;
                for (const cust of customers) {
                    await addCustomer(cust);
                    count++;
                }

                resolve(count);
            } catch (err) {
                reject(new Error('CSV-import misslyckades: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Filläsningsfel'));
        reader.readAsText(file, 'utf-8');
    });
}

export { EMPLOYEE_COLORS };
