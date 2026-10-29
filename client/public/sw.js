// Service worker de Smart Pocket Chef: guarda en el navegador lo que ya se vio para poder usarlo sin internet.
//  - Páginas y archivos de la app: se sirven de la copia guardada si la red falla.
//  - Recetas de la API (/api/recipes): primero la red, y si falla, la última respuesta guardada.
//  - Fotos, QR y fuentes (TheMealDB, Unsplash, QuickChart, Google Fonts): copia guardada primero y se actualiza detrás.
// No se guarda nada de cuentas, favoritas ni historial.
const SHELL = 'spc-shell-v1';
const DATA = 'spc-data-v1';
const MEDIA = 'spc-media-v1';
const KEEP = [SHELL, DATA, MEDIA];
const MEDIA_HOSTS = ['images.unsplash.com', 'www.themealdb.com', 'quickchart.io', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const LIMITS = { [DATA]: 400, [MEDIA]: 400 };

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add('/').catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  const extra = keys.length - LIMITS[name];
  for (let i = 0; i < extra; i += 1) await cache.delete(keys[i]);
}

async function put(name, request, response) {
  // Las respuestas "opaque" (imágenes de otros sitios) también sirven para mostrarlas sin conexión
  if (!response || (!response.ok && response.type !== 'opaque')) return;
  const copy = response.clone(); // se clona ya, antes de que la página empiece a leer la respuesta
  const cache = await caches.open(name);
  await cache.put(request, copy);
  if (LIMITS[name]) trim(name);
}

const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

// `ignoreSearch`: en el detalle de una receta, sin conexión sirve la copia aunque cambien los ingredientes marcados
async function networkFirst(request, cacheName, { ms = 7000, ignoreSearch = false } = {}) {
  try {
    const response = await withTimeout(fetch(request), ms);
    put(cacheName, request, response);
    return response;
  } catch (err) {
    const cached = await caches.match(request, { cacheName, ignoreSearch });
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request, { cacheName: MEDIA });
  const refresh = fetch(request).then((response) => { put(MEDIA, request, response); return response; }).catch(() => null);
  return cached || (await refresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Páginas de la app
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => { put(SHELL, '/', response); return response; })
        .catch(async () => (await caches.match('/', { cacheName: SHELL })) || Response.error()),
    );
    return;
  }

  // Archivos de la app con nombre único (los genera Vite al compilar): nunca cambian
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request, { cacheName: SHELL }).then((hit) => hit || fetch(request).then((response) => { put(SHELL, request, response); return response; })),
    );
    return;
  }

  // Recetas: red primero, copia guardada si falla (nunca "al azar", que debe ser nuevo cada vez)
  if (url.pathname.includes('/api/recipes') && !url.pathname.endsWith('/random')) {
    event.respondWith(networkFirst(request, DATA, { ignoreSearch: /\/api\/recipes\/\d+$/.test(url.pathname) }));
    return;
  }

  // Fotos, QR y fuentes
  if (MEDIA_HOSTS.includes(url.hostname) || request.destination === 'image' || request.destination === 'font') {
    event.respondWith(staleWhileRevalidate(request));
  }
});
