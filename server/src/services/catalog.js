import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, mapLimit } from '../utils/http.js';
import { getJson, lookupMeal, parseMeal } from './themealdb.js';
import { normalize, stem, stemMatches } from '../utils/text.js';
import { ingredientEs, isStaple, registerIngredient } from '../utils/ingredients-es.js';
import { PERU } from '../data/peru.js';
import { CATEGORIES, categoryEs } from '../utils/spanish.js';
import { peek } from './translate.js';

/**
 * La clave gratuita de TheMealDB solo filtra por UN ingrediente a la vez (el filtro de varios es premium).
 * Para buscar con varios ingredientes se sincroniza el catálogo completo (~36 peticiones GET a search.php?f=)
 * y se indexa en memoria. Se guarda una copia en server/data/catalog.json y se refresca cada 7 días.
 */
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const FILE = path.join(DIR, 'catalog.json');
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

let meals = [];
let byId = new Map();
let knownStems = [];
let suggestPool = [];
let loadedAt = 0;
let loading = null;
let partial = false; // true: solo hay recetas propias porque nunca se pudo descargar el catálogo
let retryAt = 0;

function prepare(meal) {
  return {
    ...meal,
    nameKey: normalize(meal.name),
    ingredients: meal.ingredients.map((i) => ({ ...i, stem: stem(i.name), staple: isStaple(i.name) })),
  };
}

function index(list) {
  // TheMealDB no trae comida peruana: las recetas propias se suman al catálogo y se buscan igual.
  for (const m of PERU) for (const i of m.ingredients) registerIngredient(i.name, i.es);
  meals = [...list, ...PERU].map(prepare);
  byId = new Map(meals.map((m) => [m.id, m]));

  const counts = new Map();
  for (const m of meals) {
    for (const i of m.ingredients) {
      const key = i.name.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  knownStems = [...new Set(meals.flatMap((m) => m.ingredients.map((i) => i.stem)))];

  // Autocompletado: solo ingredientes con nombre en español en el diccionario, agrupados por ese nombre.
  const bySpanish = new Map();
  for (const [en, count] of counts) {
    const es = ingredientEs(en);
    if (!es) continue;
    const key = normalize(es);
    const prev = bySpanish.get(key);
    if (prev) prev.count += count;
    else bySpanish.set(key, { es, key, count });
  }
  suggestPool = [...bySpanish.values()].sort((a, b) => b.count - a.count);
}

async function fetchAll() {
  const found = new Map();
  const failed = [];
  let aborted = false; // sin internet: tras 6 fallos seguidos sin ninguna receta, no se insiste con las demás letras

  await mapLimit(LETTERS, 6, async (letter) => {
    if (aborted) { failed.push(letter); return; }
    try {
      const data = await getJson(`/search.php?f=${letter}`, { fresh: true, timeout: 20000, retries: 1 });
      for (const raw of data.meals ?? []) found.set(raw.idMeal, parseMeal(raw));
    } catch {
      failed.push(letter);
      if (found.size === 0 && failed.length >= 6) aborted = true;
    }
  });
  if (failed.length > LETTERS.length * 0.2) {
    throw new Error(`fallaron ${failed.length} de ${LETTERS.length} peticiones a TheMealDB`);
  }

  // Recetas cuyo nombre no empieza por letra ASCII (por ejemplo "Šaltibarščiai") no salen en la búsqueda por letra.
  try {
    const lists = await mapLimit(CATEGORIES, 6, (c) => getJson(`/filter.php?c=${encodeURIComponent(c)}`, { fresh: true, retries: 1 }).catch(() => null));
    const missing = [...new Set(lists.flatMap((l) => (l?.meals ?? []).map((m) => m.idMeal)))].filter((id) => !found.has(id));
    const extra = await mapLimit(missing.slice(0, 40), 6, (id) => lookupMeal(id).catch(() => null));
    for (const meal of extra) if (meal) found.set(meal.id, meal);
  } catch { /* el complemento es opcional */ }

  return [...found.values()];
}

async function save(list) {
  const at = Date.now();
  index(list);
  loadedAt = at;
  partial = false;
  try {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify({ at, meals: list }));
  } catch (err) {
    console.warn(`Catálogo: no se pudo guardar la copia local (${err.message}).`);
  }
  console.log(`Catálogo de TheMealDB listo: ${list.length} recetas.`);
}

export function refreshCatalog() {
  if (!loading) {
    loading = fetchAll().then(save).finally(() => { loading = null; });
  }
  return loading;
}

let startup = null; // la lectura de la copia local; las búsquedas que lleguen durante el arranque la esperan

/** Carga la copia local (arranque instantáneo) y refresca en segundo plano si falta o está vieja. */
export function initCatalog() {
  startup ??= loadStartup();
  return startup;
}

async function loadStartup() {
  try {
    const snap = JSON.parse(await fs.readFile(FILE, 'utf8'));
    if (Array.isArray(snap.meals) && snap.meals.length) {
      index(snap.meals);
      loadedAt = snap.at || 0;
      console.log(`Catálogo local cargado: ${meals.length} recetas.`);
    }
  } catch { /* primera vez: no hay copia */ }

  if (!meals.length || Date.now() - loadedAt > MAX_AGE_MS) {
    console.log('Sincronizando el catálogo de TheMealDB en segundo plano…');
    refreshCatalog().catch((err) => console.warn(`Catálogo: ${err.message}`));
  }
}

/**
 * Garantiza que haya un catálogo. Sin copia local y sin internet, la app arranca igual con las recetas propias
 * (las peruanas) y reintenta sincronizar cada minuto; `isPartial()` avisa a la pantalla.
 */
export async function ensureCatalog() {
  if (startup) await startup; // si el arranque aún está leyendo la copia local, no se descarga todo de nuevo
  if (meals.length && !partial) return;
  if (meals.length) { // catálogo incompleto: se reintenta en segundo plano sin hacer esperar a nadie
    if (Date.now() >= retryAt && !loading) {
      retryAt = Date.now() + 60_000;
      refreshCatalog().catch(() => {});
    }
    return;
  }
  try {
    await refreshCatalog();
  } catch (err) {
    index([]);
    partial = true;
    retryAt = Date.now() + 60_000;
    console.warn(`Catálogo: sin copia local ni conexión con TheMealDB (${err.message}). Solo hay recetas propias hasta sincronizar.`);
  }
}

export const isPartial = () => partial;
/** Nombres (en inglés) de las recetas de TheMealDB; las propias ya están en español. */
export const catalogNames = () => meals.filter((m) => !m.local).map((m) => m.name);
export const catalogSize = () => meals.length;
export const catalogMeal = (id) => byId.get(String(id)) ?? null;
export const randomCatalogMeal = () => meals[Math.floor(Math.random() * meals.length)] ?? null;

/** ¿Alguna receta usa un ingrediente que coincida con estos nombres (ya "stemmed")? */
export const isKnown = (stems) => stems.some((s) => knownStems.some((k) => stemMatches(s, k)));

const card = (m, extra = {}) => ({
  id: m.id, name: m.name, nameEn: m.nameEn, category: m.category, area: m.area, thumb: m.thumb,
  local: Boolean(m.local), photoQuery: m.photo, picture: m.picture, ...extra,
});

const byName = (a, b) => a.name.localeCompare(b.name);

function facetsOf(list) {
  const counts = new Map();
  for (const r of list) if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, label: categoryEs(id), count }));
}

/**
 * Busca por ingredientes. `groups` = [{ label, stems }]: cada grupo es un ingrediente del usuario con sus
 * equivalencias en inglés. Con `pantry`, sal, pimienta, agua y aceite no cuentan como ingredientes que faltan.
 */
export function searchMeals({ groups, pantry, mode, category, sort }) {
  const active = groups.filter((g) => g.known);
  const scored = [];

  for (const m of meals) {
    let used = 0;
    const have = new Set();
    for (const g of active) {
      let hit = false;
      m.ingredients.forEach((ing, idx) => {
        if (g.stems.some((s) => stemMatches(s, ing.stem))) { hit = true; have.add(idx); }
      });
      if (hit) used += 1;
    }
    if (used === 0) continue;
    if (mode === 'all' && used < active.length) continue;

    let total = 0;
    let matched = 0;
    m.ingredients.forEach((ing, idx) => {
      if (pantry && ing.staple) return;
      total += 1;
      if (have.has(idx)) matched += 1;
    });
    scored.push(card(m, { total, matched, missing: total - matched, used }));
  }

  const facets = facetsOf(scored);
  const list = category ? scored.filter((r) => r.category === category) : scored;
  if (sort === 'missing') list.sort((a, b) => a.missing - b.missing || b.used - a.used || byName(a, b));
  else list.sort((a, b) => b.used - a.used || a.missing - b.missing || b.matched - a.matched || byName(a, b));
  return { list, facets };
}

/** Explora el catálogo por nombre y/o categoría. `tokens` = [[candidatos de la palabra 1], [palabra 2], …]. */
export function exploreMeals({ tokens = [], category, area }) {
  const scored = [];
  for (const m of meals) {
    if (area && m.area !== area) continue;
    if (tokens.length) {
      const es = normalize(m.local ? m.name : peek(m.name) ?? '');
      const ok = tokens.every((cands) => cands.some((c) => m.nameKey.includes(c) || (es && es.includes(c))));
      if (!ok) continue;
    }
    scored.push(card(m));
  }
  const facets = facetsOf(scored);
  const list = category ? scored.filter((r) => r.category === category) : scored;
  list.sort(byName);
  return { list, facets };
}

export const countByArea = (area) => meals.filter((m) => m.area === area).length;

export function listCategories() {
  const counts = new Map();
  for (const m of meals) if (m.category) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, label: categoryEs(id), count }));
}

export function suggestIngredients(query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const item of suggestPool) {
    if (item.key.startsWith(q)) starts.push(item);
    else if (item.key.split(' ').some((w) => w.startsWith(q)) || (q.length > 2 && item.key.includes(q))) contains.push(item);
  }
  starts.sort((a, b) => a.key.length - b.key.length || b.count - a.count); // "pol" -> pollo antes que "polvo de hornear"
  return [...starts, ...contains].slice(0, limit).map((i) => i.es);
}
