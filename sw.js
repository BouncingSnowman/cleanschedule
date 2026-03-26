/**
 * Veckoplan — Service Worker
 * Handles push notifications and notification clicks
 */

self.addEventListener('push', (event) => {
    let data = { title: 'Veckoplan', body: '' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body || '',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✨</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📋</text></svg>',
        tag: data.tag || 'veckoplan-notification',
        data: { url: data.url || '/cleanschedule/' },
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Veckoplan', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/cleanschedule/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Focus existing window if open
            for (const client of windowClients) {
                if (client.url.includes('/cleanschedule/') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new window
            return clients.openWindow(url);
        })
    );
});

// Basic install/activate
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
