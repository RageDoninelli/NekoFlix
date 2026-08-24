// NEKOFLIX — Service Worker (Fase 8)
// Estrategia a propósito conservadora, después de lo que costó resolver
// los problemas de caché en fases anteriores:
//   - El HTML principal SIEMPRE se pide primero a la red (network-first).
//     Solo se usa la copia guardada si no hay internet. Así, cuando subas
//     una versión nueva a GitHub, se ve reflejada de inmediato — nunca
//     hace falta el truco de agregar "?v=2" a la URL.
//   - Imágenes/íconos/manifest sí se guardan en caché (cache-first) para
//     que carguen más rápido y funcionen sin conexión.
//   - Todo lo que va a Supabase, Google Drive o servicios externos NUNCA
//     pasa por esta caché — siempre va directo a la red.

const CACHE_NAME = 'nekoflix-shell-v1';
const APP_SHELL = [
  './nekoflix-1.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;               // nunca intervenir en escrituras
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nunca cachear Supabase/Drive/externos

  const isHtml = req.mode === 'navigate' || url.pathname.endsWith('.html');

  if (isHtml) {
    // Network-first: intenta la red; si falla (sin conexión), usa la caché.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first para el resto de archivos propios (imágenes, íconos, manifest).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
