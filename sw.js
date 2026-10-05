/* Lingua Field service worker.
   Bump VERSION whenever you deploy a new index.html so the precache is refreshed. */
const VERSION = 'v2';
const CACHE = 'lingua-field-' + VERSION;
const RUNTIME = 'lingua-field-runtime';   // Google Fonts (cross-origin), kept across versions
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE && k!==RUNTIME).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

function networkFirstPage(req){
  const net = fetch(req).then(res=>{
    if(res && res.ok){ const copy = res.clone(); caches.open(CACHE).then(c=>c.put('./index.html', copy)); }
    return res;
  });
  // On a slow/flaky connection, don't make the user wait: fall back to the cached page after 3 s.
  const timeout = new Promise((_, rej)=>setTimeout(()=>rej(new Error('timeout')), 3000));
  return Promise.race([net, timeout]).catch(async ()=>{
    return (await caches.match('./index.html')) || (await caches.match('./')) || net;
  });
}

function staleWhileRevalidate(req, cacheName){
  return caches.open(cacheName).then(async cache=>{
    const cached = await cache.match(req);
    const fresh = fetch(req).then(res=>{
      if(res && (res.ok || res.type==='opaque')) cache.put(req, res.clone());
      return res;
    }).catch(()=>null);
    return cached || (await fresh) || Response.error();
  });
}

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method!=='GET') return;                       // never touch POSTs (e.g. api.anthropic.com)
  const url = new URL(req.url);
  if(req.mode==='navigate'){ e.respondWith(networkFirstPage(req)); return; }
  if(url.origin===location.origin){ e.respondWith(staleWhileRevalidate(req, CACHE)); return; }
  if(url.hostname==='fonts.googleapis.com' || url.hostname==='fonts.gstatic.com'){
    e.respondWith(staleWhileRevalidate(req, RUNTIME));
  }
  // everything else: default network behaviour
});
