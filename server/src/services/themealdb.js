import { HttpError } from '../utils/http.js';
import { createBreaker } from '../utils/breaker.js';

export const breaker = createBreaker('TheMealDB');

// Cliente de TheMealDB (API 1). La clave "1" es la pública para desarrollo y estudio.
// Para publicar la app hay que pasar a una clave de supporter (ver README).
const BASE = 'https://www.themealdb.com/api/json/v1/1';
const TTL_MS = 30 * 60 * 1000;
const cache = new Map();

/** GET a TheMealDB con caché de 30 min. `fresh` salta la caché (para random.php y la sincronización). */
export async function getJson(path, { fresh = false, timeout = 8000, retries = 0 } = {}) {
  if (!fresh) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  }

  // Sin internet: se falla enseguida y quien llama usa la copia local (la sincronización del catálogo sí insiste)
  if (!fresh && breaker.open) throw new HttpError(502, 'Sin conexión con TheMealDB.');

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(BASE + path, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`TheMealDB respondió ${res.status}`);
      let data;
      try {
        data = JSON.parse(await res.text());
      } catch {
        data = { meals: null }; // TheMealDB a veces responde vacío cuando no hay resultados
      }
      breaker.reset();
      if (!fresh) {
        if (cache.size > 500) cache.clear();
        cache.set(path, { at: Date.now(), data });
      }
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  breaker.trip(lastError);
  throw new HttpError(502, `No se pudo conectar con TheMealDB (${lastError?.message ?? 'sin respuesta'}).`);
}

function toSteps(text = '') {
  let steps = text
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => s && !/^(?:step\s*)?\d+[.):-]?$/i.test(s))
    .map((s) => s.replace(/^(?:step\s*\d+[.):-]?|\d+[.)])\s*/i, ''));
  if (steps.length <= 2 && steps.join(' ').length > 200) {
    steps = steps.join(' ').split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  }
  return steps.filter(Boolean);
}

/** TheMealDB entrega 20 campos sueltos de ingredientes y medidas: aquí se juntan en una lista. */
export function parseMeal(raw) {
  const ingredients = [];
  for (let i = 1; i <= 20; i += 1) {
    const name = (raw[`strIngredient${i}`] || '').trim();
    if (name) ingredients.push({ name, measure: (raw[`strMeasure${i}`] || '').trim() });
  }
  return {
    id: raw.idMeal,
    name: (raw.strMeal || '').trim(),
    category: raw.strCategory || '',
    area: raw.strArea || '',
    thumb: raw.strMealThumb || '',
    youtube: raw.strYoutube || '',
    source: raw.strSource || '',
    ingredients,
    steps: toSteps(raw.strInstructions),
  };
}

export async function lookupMeal(id) {
  if (!/^\d+$/.test(String(id))) throw new HttpError(400, 'Identificador de receta inválido.');
  const data = await getJson(`/lookup.php?i=${id}`);
  return data.meals?.[0] ? parseMeal(data.meals[0]) : null;
}

export async function randomMeal() {
  const data = await getJson('/random.php', { fresh: true });
  return data.meals?.[0] ? parseMeal(data.meals[0]) : null;
}

/** TheMealDB sirve la misma foto en varios tamaños: /small, /medium y /large. */
export const photo = (url, size) => (url && size ? `${url}/${size}` : url || '');
