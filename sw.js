const CACHE = 'euthyrox-v4';
const ASSETS = [
  '/euthyrox-tracker/',
  '/euthyrox-tracker/index.html',
  '/euthyrox-tracker/manifest.json',
  '/euthyrox-tracker/sw.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('/euthyrox-tracker/index.html')))
  );
});

// Przechowuj timer ID
let notifTimer = null;

self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.action === 'schedule_notification') {
    const { delayMs, title, body } = e.data;

    // Anuluj poprzedni timer
    if (notifTimer) clearTimeout(notifTimer);

    if (delayMs <= 0 || delayMs > 24 * 60 * 60 * 1000) return;

    notifTimer = setTimeout(() => {
      self.registration.showNotification(title, {
        body: body,
        icon: '/euthyrox-tracker/icon-192.png',
        badge: '/euthyrox-tracker/icon-192.png',
        vibrate: [300, 100, 300, 100, 300],
        tag: 'euthyrox-daily',
        renotify: true,
        requireInteraction: true,
        actions: [
          { action: 'taken', title: 'Wziąlem!' },
          { action: 'later', title: 'Za 15 min' }
        ],
        data: { scheduledTime: Date.now() + delayMs }
      });
    }, delayMs);

    // Potwierdz do klienta
    e.source && e.source.postMessage({
      action: 'scheduled_ok',
      delayMs: delayMs,
      fireAt: Date.now() + delayMs
    });
  }

  if (e.data.action === 'cancel_notification') {
    if (notifTimer) { clearTimeout(notifTimer); notifTimer = null; }
  }

  if (e.data.action === 'test_notification') {
    self.registration.showNotification('Euthyrox - TEST', {
      body: 'Powiadomienia dzialaja! Czas na tabletkę na czczo.',
      icon: '/euthyrox-tracker/icon-192.png',
      vibrate: [300, 100, 300],
      tag: 'euthyrox-test',
      requireInteraction: true,
      actions: [
        { action: 'taken', title: 'Wziálem!' },
        { action: 'later', title: 'Za 15 min' }
      ]
    });
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'taken') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        const c = clients.find(c => c.url.includes('euthyrox-tracker'));
        if (c) { c.postMessage({ action: 'take_pill' }); return c.focus(); }
        return self.clients.openWindow('/euthyrox-tracker/?action=take');
      })
    );
  } else if (e.action === 'later') {
    // Przypomnij za 15 minut
    setTimeout(() => {
      self.registration.showNotification('Euthyrox - przypomnienie', {
        body: 'Nie zapomnij wziac tabletki na czczo!',
        icon: '/euthyrox-tracker/icon-192.png',
        tag: 'euthyrox-reminder',
        requireInteraction: true,
        vibrate: [300, 100, 300],
        actions: [
          { action: 'taken', title: 'Wziálem!' }
        ]
      });
    }, 15 * 60 * 1000);
  } else {
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        const c = clients.find(c => c.url.includes('euthyrox-tracker'));
        if (c) return c.focus();
        return self.clients.openWindow('/euthyrox-tracker/');
      })
    );
  }
});
