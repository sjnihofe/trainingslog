// Minimaler Service Worker: macht die App unter Android installierbar.
// Daten kommen immer live vom Server (kein Offline-Cache, damit nichts veraltet).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
