import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { createBreaker } from '../utils/breaker.js';

const breaker = createBreaker('Unsplash', 5 * 60 * 1000);

// Unsplash (API 2). Solo se llama desde el servidor: la Access Key viaja en una cabecera y nunca llega al navegador.
// Reglas de Unsplash que se cumplen aquí: usar las URLs de photo.urls (hotlink), dar crédito con UTM y avisar
// al endpoint download_location cuando una foto se usa. El modo demo permite 50 peticiones por hora.
const UTM = 'utm_source=smart_pocket_chef&utm_medium=referral';
const cache = new Map();
// Las fotos de los platos peruanos se guardan en disco: así no se vuelve a gastar la cuota de 50 por hora tras reiniciar.
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const FILE = path.join(DIR, 'photos.json');
try {
  for (const [key, value] of Object.entries(JSON.parse(fs.readFileSync(FILE, 'utf8')))) cache.set(key, value);
} catch { /* primera vez: no hay copia */ }
function persist() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries([...cache].filter(([, v]) => v))));
  } catch { /* la caché en disco es opcional */ }
}
const HERO_TTL_MS = 12 * 60 * 60 * 1000;
let hero = { at: 0, value: null };
let pausedUntil = 0; // si Unsplash responde 403/429 (cuota agotada), se deja de insistir un rato

const headers = () => ({ Authorization: `Client-ID ${config.unsplashKey}`, 'Accept-Version': 'v1' });

function toPhoto(photo) {
  return {
    url: photo.urls.regular,
    credit: {
      name: photo.user?.name ?? 'Unsplash',
      link: `${photo.user?.links?.html ?? 'https://unsplash.com'}?${UTM}`,
    },
    downloadLocation: photo.links?.download_location ?? null,
  };
}

async function call(url) {
  if (Date.now() < pausedUntil) throw new Error('cuota agotada, se reintenta más tarde');
  if (breaker.open) throw new Error('sin conexión con Unsplash');
  let res;
  try {
    res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(8000) });
  } catch (err) {
    breaker.trip(err); // sin internet: no se vuelve a intentar por unos minutos
    throw err;
  }
  breaker.reset();
  if (res.status === 403 || res.status === 429) {
    pausedUntil = Date.now() + 15 * 60 * 1000;
    throw new Error(`Unsplash respondió ${res.status} (límite por hora alcanzado)`);
  }
  if (!res.ok) throw new Error(`Unsplash respondió ${res.status}`);
  return res.json();
}

/** Busca una foto por nombre de platillo. */
export async function searchPhoto(query) {
  if (!config.unsplashKey || !query) return null;
  const key = query.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', /food/i.test(query) ? query : `${query} food`);
    url.searchParams.set('per_page', '1');
    url.searchParams.set('orientation', 'landscape');
    const photo = (await call(url)).results?.[0];
    const value = photo ? toPhoto(photo) : null;
    if (cache.size > 300) cache.clear();
    cache.set(key, value);
    if (value) persist();
    return value;
  } catch (err) {
    console.warn(`Unsplash: ${err.message}`);
    return null; // los fallos no se guardan en caché
  }
}

/** Foto de portada de la página de inicio. Cambia cada día y se guarda 12 horas para gastar muy pocas peticiones. */
export async function heroPhoto() {
  if (!config.unsplashKey) return null;
  if (hero.value && Date.now() - hero.at < HERO_TTL_MS) return hero.value;

  try {
    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', 'fresh vegetables cooking table');
    url.searchParams.set('per_page', '10');
    url.searchParams.set('orientation', 'landscape');
    const results = (await call(url)).results ?? [];
    const day = Math.floor(Date.now() / 86_400_000);
    const photo = results[day % Math.max(results.length, 1)];
    hero = { at: Date.now(), value: photo ? toPhoto(photo) : null };
    return hero.value;
  } catch (err) {
    console.warn(`Unsplash (portada): ${err.message}`);
    return hero.value; // si ya había una foto, se sigue usando
  }
}

/** Cumple la regla de Unsplash: avisar cuando la app usa una foto (no cuenta como descarga del usuario). */
export function trackUse(photo) {
  if (!photo?.downloadLocation || photo.tracked || !config.unsplashKey) return;
  photo.tracked = true;
  fetch(photo.downloadLocation, { headers: headers(), signal: AbortSignal.timeout(5000) }).catch(() => {});
}
