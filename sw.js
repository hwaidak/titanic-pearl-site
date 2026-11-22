// Titanic Pearl HR – service worker: keeps the app shell available and fast. Data calls (Supabase) are never cached.
const CACHE = 'tp-shell-v3';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) return;
  if (req.mode === 'navigate') {            // always try the network first so new versions show immediately
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('./index.html', c)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async cache => {   // assets: serve cached, refresh in background
    const hit = await cache.match(req);
    const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});

// phone notifications (Web Push): every request / approval reaches the employee even when the app is closed
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Titanic Pearl', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Titanic Pearl', {
    body: d.body || '', icon: './icon-192.png', badge: './icon-192.png', tag: d.tag, data: { url: d.url || '#/notifications' }, dir: 'auto',
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL(self.registration.scope).href.split('#')[0] + (e.notification.data?.url || '#/notifications');
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.focus(); if ('navigate' in c) try { await c.navigate(target); } catch {} return; } }
    await self.clients.openWindow(target);
  })());
});
