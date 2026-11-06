// autobuild 알림 — 푸시를 받아 알림으로 띄우고, 받은 목록을 저장한다.
const CACHE = 'ab-app-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ab-app-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(h => h || caches.match('./index.html'))));
});

async function remember(m) {
  const c = await caches.open('ab-inbox');
  const r = await c.match('inbox');
  const list = r ? await r.json() : [];
  list.push(m);
  await c.put('inbox', new Response(JSON.stringify(list.slice(-50)), { headers: { 'content-type': 'application/json' } }));
  (await self.clients.matchAll()).forEach(cl => cl.postMessage('inbox'));
}

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'autobuild', body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'autobuild';
  e.waitUntil(Promise.all([
    remember({ title, body: d.body || '', t: Date.now() }),
    self.registration.showNotification(title, {
      body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || undefined,
      renotify: !!d.tag, requireInteraction: !!d.urgent, data: { url: './' },
    }),
  ]));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
