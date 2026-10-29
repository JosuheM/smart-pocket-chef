import { config } from '../config.js';
import { isDbReady } from '../db.js';
import { catalogSize, isPartial } from './catalog.js';
import { provider } from './translate.js';

// Estado de cada servicio externo, para revisar antes de exponer y saber qué plan B queda activo.
// Se guarda 60 segundos para que mirar el estado no gaste cuota de las APIs.
const TTL_MS = 60 * 1000;
let cached = { at: 0, value: null };

async function probe(url, init = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), ...init });
    return { up: res.status < 500, ms: Date.now() - started };
  } catch {
    return { up: false, ms: Date.now() - started };
  }
}

export async function serviceStatus({ fresh = false } = {}) {
  if (!fresh && cached.value && Date.now() - cached.at < TTL_MS) return cached.value;

  const [meal, unsplash, quickchart, mymemory] = await Promise.all([
    probe('https://www.themealdb.com/api/json/v1/1/lookup.php?i=52772'),
    // Solo se comprueba que el servidor responda: una petición real gastaría de la cuota de 50 por hora
    config.unsplashKey ? probe('https://api.unsplash.com/', { method: 'HEAD' }) : Promise.resolve(null),
    probe('https://quickchart.io/qr?text=ok&size=40'),
    provider === 'mymemory' ? probe('https://api.mymemory.translated.net/get?q=hi&langpair=en|es') : Promise.resolve(null),
  ]);

  const services = {
    themealdb: { ...meal, label: 'TheMealDB (recetas)', fallback: 'copia local del catálogo' },
    unsplash: unsplash
      ? { ...unsplash, label: 'Unsplash (fotos)', fallback: 'fotos fijas y degradado verde' }
      : { up: false, ms: 0, label: 'Unsplash (fotos)', note: 'sin clave en el .env', fallback: 'fotos fijas y degradado verde' },
    quickchart: { ...quickchart, label: 'QuickChart (QR)', fallback: 'QR generado en el navegador' },
    translation: provider === 'mymemory'
      ? { ...mymemory, label: 'MyMemory (traducción)', fallback: 'traducciones guardadas o inglés' }
      : provider === 'deepl'
        ? { up: true, ms: 0, label: 'DeepL (traducción)', note: 'no se comprueba para no gastar cuota', fallback: 'traducciones guardadas o inglés' }
        : { up: false, ms: 0, label: 'Traducción', note: 'desactivada', fallback: 'texto en inglés' },
  };

  const value = {
    internet: Object.values(services).some((s) => s.up),
    services,
    database: { up: isDbReady(), label: 'MySQL', fallback: 'sin cuentas, favoritas ni historial' },
    catalog: { recipes: catalogSize(), partial: isPartial() },
    checkedAt: new Date().toISOString(),
  };
  cached = { at: Date.now(), value };
  return value;
}
