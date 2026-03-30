/**
 * Veckoplan — ICS Calendar Export
 * Generates .ics (iCalendar) files for week's jobs
 */

/**
 * Download an .ics file for a week's jobs for a specific employee
 * @param {Array} occurrences - Job occurrences for the week
 * @param {Array} customers - All customers
 * @param {Object} employee - The employee to export for
 * @param {number|null} reminderMinutes - Reminder before each event (null = no reminder)
 * @param {string} weekLabel - Human-readable week label for filename
 */
export function downloadWeekIcs(occurrences, customers, employee, reminderMinutes, weekLabel) {
    const empJobs = occurrences.filter(j => j.employeeId === employee.id);

    if (empJobs.length === 0) {
        return false; // No jobs to export
    }

    const events = empJobs.map(job => {
        const customer = customers.find(c => c.id === job.customerId);
        const custName = customer?.name || 'Okänd kund';
        const address = customer?.address || '';
        const hours = parseFloat(String(job.hours || 2).replace(',', '.')) || 2;

        // Parse start datetime
        const startTime = job.startTime || '08:00';
        const [startH, startM] = startTime.split(':').map(Number);
        const startDate = new Date(job.occurrenceDate || job.date);
        startDate.setHours(startH, startM, 0, 0);

        // End datetime
        const endDate = new Date(startDate);
        const durationMs = hours * 60 * 60 * 1000;
        endDate.setTime(endDate.getTime() + durationMs);

        // Build description
        const descParts = [];
        if (employee.name) descParts.push(`Anställd: ${employee.name}`);
        if (job.hours) descParts.push(`Timmar: ${String(job.hours).replace('.', ',')}h`);
        if (job.notes) descParts.push(`Anteckningar: ${job.notes}`);
        const description = descParts.join('\\n');

        return buildVEvent({
            summary: custName,
            dtStart: formatIcsDate(startDate),
            dtEnd: formatIcsDate(endDate),
            location: address,
            description,
            uid: `${job.id}-${job.occurrenceDate || job.date}@veckoplan`,
            reminderMinutes,
        });
    });

    const calendar = buildVCalendar(events);
    const filename = `veckoplan-${sanitizeFilename(employee.name)}-${weekLabel}.ics`;
    triggerDownload(calendar, filename);
    return true;
}

// --- ICS Formatting ---

function buildVCalendar(events) {
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Veckoplan//CleanSchedule//SV',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Veckoplan',
        ...events,
        'END:VCALENDAR',
    ].join('\r\n');
}

function buildVEvent({ summary, dtStart, dtEnd, location, description, uid, reminderMinutes }) {
    const lines = [
        'BEGIN:VEVENT',
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escIcs(summary)}`,
        `UID:${uid}`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
    ];

    if (location) lines.push(`LOCATION:${escIcs(location)}`);
    if (description) lines.push(`DESCRIPTION:${escIcs(description)}`);

    // Add reminder (VALARM)
    if (reminderMinutes && reminderMinutes > 0) {
        lines.push(
            'BEGIN:VALARM',
            'TRIGGER:-PT' + reminderMinutes + 'M',
            'ACTION:DISPLAY',
            `DESCRIPTION:${escIcs(summary)} börjar snart`,
            'END:VALARM'
        );
    }

    lines.push('END:VEVENT');
    return lines.join('\r\n');
}

/**
 * Format a Date as ICS datetime string (local time, no timezone = floating)
 * Format: YYYYMMDDTHHMMSS
 */
function formatIcsDate(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) + 'T' +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds());
}

/** Escape special characters for ICS text fields */
function escIcs(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

/** Make a safe filename from a string */
function sanitizeFilename(str) {
    return (str || 'export')
        .toLowerCase()
        .replace(/[åä]/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/** Trigger a browser download of text content */
function triggerDownload(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
