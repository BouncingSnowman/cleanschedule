/**
 * CleanSchedule — Data Store
 * Handles all data persistence via localStorage.
 */

const STORAGE_KEY = 'cleanschedule_data';

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

function getDefaultData() {
    return {
        employees: [],
        customers: [],
        jobs: [],
        timeOff: [],
    };
}

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultData();
        const data = JSON.parse(raw);
        // Ensure all arrays exist
        return {
            employees: data.employees || [],
            customers: data.customers || [],
            jobs: data.jobs || [],
            timeOff: data.timeOff || [],
        };
    } catch (e) {
        console.error('Failed to load data:', e);
        return getDefaultData();
    }
}

function saveData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save data:', e);
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// --- Employees ---

export function getEmployees() {
    return loadData().employees;
}

export function getEmployee(id) {
    return loadData().employees.find(e => e.id === id);
}

export function addEmployee(employee) {
    const data = loadData();
    employee.id = generateId();
    data.employees.push(employee);
    saveData(data);
    return employee;
}

export function updateEmployee(id, updates) {
    const data = loadData();
    const idx = data.employees.findIndex(e => e.id === id);
    if (idx === -1) return null;
    data.employees[idx] = { ...data.employees[idx], ...updates };
    saveData(data);
    return data.employees[idx];
}

export function deleteEmployee(id) {
    const data = loadData();
    data.employees = data.employees.filter(e => e.id !== id);
    // Also remove their jobs
    data.jobs = data.jobs.filter(j => j.employeeId !== id);
    saveData(data);
}

// --- Customers ---

export function getCustomers() {
    return loadData().customers;
}

export function getCustomer(id) {
    return loadData().customers.find(c => c.id === id);
}

export function addCustomer(customer) {
    const data = loadData();
    customer.id = generateId();
    data.customers.push(customer);
    saveData(data);
    return customer;
}

export function updateCustomer(id, updates) {
    const data = loadData();
    const idx = data.customers.findIndex(c => c.id === id);
    if (idx === -1) return null;
    data.customers[idx] = { ...data.customers[idx], ...updates };
    saveData(data);
    return data.customers[idx];
}

export function deleteCustomer(id) {
    const data = loadData();
    data.customers = data.customers.filter(c => c.id !== id);
    // Also remove their jobs
    data.jobs = data.jobs.filter(j => j.customerId !== id);
    saveData(data);
}

// --- Jobs ---

export function getJobs() {
    return loadData().jobs;
}

export function getJobsForWeek(weekStart) {
    const data = loadData();
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return data.jobs.filter(job => {
        // Direct match - job falls in this week
        const jobDate = new Date(job.date);
        if (jobDate >= start && jobDate <= end) return true;

        // Recurring job - check if it occurs this week
        if (job.recurring && job.recurring !== 'none') {
            return doesRecurringJobFallInWeek(job, start, end);
        }

        return false;
    });
}

function doesRecurringJobFallInWeek(job, weekStart, weekEnd) {
    const jobDate = new Date(job.date);
    const dayOfWeek = jobDate.getDay(); // 0=Sun, 1=Mon, ...

    // Find the date in this week that matches the same day of week
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === dayOfWeek) {
            const targetDate = new Date(d);
            if (targetDate <= jobDate) continue; // Only future occurrences

            if (job.recurring === 'weekly') return true;

            if (job.recurring === 'biweekly') {
                const diffTime = targetDate - jobDate;
                const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));
                if (diffWeeks % 2 === 0) return true;
            }

            if (job.recurring === 'monthly') {
                if (targetDate.getDate() === jobDate.getDate()) return true;
            }
        }
    }
    return false;
}

export function getJobOccurrencesForWeek(weekStart) {
    const data = loadData();
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const occurrences = [];

    for (const job of data.jobs) {
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
    const data = loadData();
    return data.jobs.filter(j => !j.employeeId || !j.date);
}

export function addJob(job) {
    const data = loadData();
    job.id = generateId();
    data.jobs.push(job);
    saveData(data);
    return job;
}

export function updateJob(id, updates) {
    const data = loadData();
    const idx = data.jobs.findIndex(j => j.id === id);
    if (idx === -1) return null;
    data.jobs[idx] = { ...data.jobs[idx], ...updates };
    saveData(data);
    return data.jobs[idx];
}

export function deleteJob(id) {
    const data = loadData();
    data.jobs = data.jobs.filter(j => j.id !== id);
    saveData(data);
}

// --- Time Off ---

export function getTimeOff() {
    return loadData().timeOff || [];
}

export function getTimeOffForEmployee(employeeId) {
    return (loadData().timeOff || []).filter(t => t.employeeId === employeeId);
}

export function addTimeOff(entry) {
    const data = loadData();
    if (!data.timeOff) data.timeOff = [];
    entry.id = generateId();
    data.timeOff.push(entry);
    saveData(data);
    return entry;
}

export function deleteTimeOff(id) {
    const data = loadData();
    data.timeOff = (data.timeOff || []).filter(t => t.id !== id);
    saveData(data);
}

export function isEmployeeOffOnDate(employeeId, dateStr) {
    const timeOff = loadData().timeOff || [];
    const d = new Date(dateStr);
    return timeOff.some(t => {
        if (t.employeeId !== employeeId) return false;
        const start = new Date(t.startDate);
        const end = new Date(t.endDate);
        return d >= start && d <= end;
    });
}

// --- Export/Import ---

export function exportData() {
    const data = loadData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleanschedule-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.employees || !data.customers || !data.jobs) {
                    reject(new Error('Ogiltig fil'));
                    return;
                }
                saveData(data);
                resolve(data);
            } catch (err) {
                reject(new Error('Kunde inte läsa filen'));
            }
        };
        reader.onerror = () => reject(new Error('Filläsningsfel'));
        reader.readAsText(file);
    });
}

export { EMPLOYEE_COLORS };
