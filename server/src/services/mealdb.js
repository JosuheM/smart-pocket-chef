import { config } from '../config.js';
import { HttpError } from '../utils/http.js';
import { normalize, stem, stemMatches } from '../utils/text.js';
import { DISH_WORDS, ingredientEs, isStaple, spanishToEnglish } from '../utils/ingredients-es.js';
import { CATEGORIES, areaEs, categoryEs, measureEs, poundsToMetric } from '../utils/spanish.js';
import { lookupMeal, photo, randomMeal } from './themealdb.js';
import {
  catalogMeal, countByArea, ensureCatalog, exploreMeals, isKnown, isPartial, listCategories, randomCatalogMeal, searchMeals, suggestIngredients,
} from './catalog.js';
import { heroPhoto, searchPhoto, trackUse } from './unsplash.js';
import { provider, translateMany, translateOne } from './translate.js';

const MAX_TERMS = 10;
const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'en', 'a', 'al', 'un', 'una']);
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Convierte lo que escribió el usuario en grupos de equivalencias en inglés.
 * "pollo" -> chicken; "pechuga" -> chicken breast; si no está en el diccionario se traduce con la API.
 */
async function resolveTerm(raw) {
  const n = normalize(raw);
  let alts = spanishToEnglish(raw);
  if (!alts && isKnown([stem(n)])) alts = [n]; // ya estaba escrito en inglés
  if (!alts && provider) {
    const en = normalize(await translateOne(raw, 'es|en'));
    if (en && en !== n) alts = [en];
  }
  alts ??= [n];
  const stems = [...new Set(alts.map(stem))];
  return { label: raw, alts, stems, known: isKnown(stems) };
}

export async function resolveTerms(rawTerms) {
  const seen = new Set();
  const terms = rawTerms
    .map((t) => String(t).trim().slice(0, 40))
    .filter((t) => {
      const key = normalize(t);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_TERMS);
  return Promise.all(terms.map(resolveTerm));
}

/** Una foto de TheMealDB (tamaño mediano para las tarjetas) o, si falta, de Unsplash. */
async function cardImage(meal) {
  if (meal.thumb) return { image: photo(meal.thumb, 'medium'), credit: null };
  if (meal.picture) return { image: meal.picture.url, credit: meal.picture.credit }; // foto fija: no gasta cuota
  const found = await searchPhoto(meal.photoQuery ?? meal.name);
  if (found) { trackUse(found); return { image: found.url, credit: found.credit }; }
  return { image: null, credit: null };
}

/** Pasa las tarjetas al español: nombre traducido (con caché), categoría y país con listas fijas. */
async function decorate(page) {
  const names = await translateMany(page.map((m) => (m.local ? '' : m.name))); // las recetas propias ya están en español
  return Promise.all(page.map(async (m, i) => {
    const { thumb, photoQuery, picture, ...rest } = m;
    const img = await cardImage(m);
    return {
      ...rest,
      name: m.local ? m.name : names[i].trim(),
      nameEn: m.local ? m.nameEn : m.name,
      category: categoryEs(m.category),
      categoryId: m.category,
      area: areaEs(m.area),
      image: img.image,
      imageCredit: img.credit,
    };
  }));
}

const validCategory = (c) => (CATEGORIES.includes(c) ? c : '');

function paginate(list, facets, offset, limit) {
  return { total: list.length, facets, hasMore: offset + limit < list.length, page: list.slice(offset, offset + limit) };
}

export async function searchRecipes({ terms, mode, category, sort, pantry, limit, offset }) {
  await ensureCatalog();
  const groups = await resolveTerms(terms);
  const { list, facets } = searchMeals({
    groups, pantry, mode: mode === 'all' ? 'all' : 'any', category: validCategory(category), sort: sort === 'missing' ? 'missing' : 'match',
  });
  const { page, ...meta } = paginate(list, facets, offset, limit);
  return {
    ingredients: groups.map(({ label, known }) => ({ label, known })),
    unknown: groups.filter((g) => !g.known).map((g) => g.label),
    ...meta,
    results: await decorate(page),
  };
}

/** Palabras de la búsqueda por nombre con sus equivalencias en inglés (el catálogo está en inglés). */
async function queryTokens(q) {
  const words = normalize(q).split(' ').filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const tokens = words.map((w) => {
    const cands = new Set([w, ...(DISH_WORDS[w] ?? [])]);
    for (const alt of spanishToEnglish(w) ?? []) for (const part of normalize(alt).split(' ')) cands.add(part);
    return cands;
  });
  if (provider && tokens.some((c) => c.size === 1)) {
    const en = normalize(await translateOne(words.join(' '), 'es|en'));
    for (const part of en.split(' ').filter((p) => p.length > 1 && !STOPWORDS.has(p))) tokens.forEach((c) => c.add(part));
  }
  return tokens.map((c) => [...c]);
}

export async function exploreRecipes({ q, category, area, limit, offset }) {
  await ensureCatalog();
  const tokens = q ? await queryTokens(q) : [];
  const { list, facets } = exploreMeals({ tokens, category: validCategory(category), area: /^[A-Za-z ]{1,30}$/.test(area ?? '') ? area : '' });
  const { page, ...meta } = paginate(list, facets, offset, limit);
  return { ingredients: [], unknown: [], ...meta, results: await decorate(page) };
}

/** Receta propia (comida peruana): ya está en español, solo se marcan los ingredientes y se busca la foto. */
async function getLocalRecipe(meal, haveTerms, pantry) {
  const groups = await resolveTerms(haveTerms);
  const found = meal.picture ?? (await searchPhoto(meal.photo));
  if (found) trackUse(found);
  return {
    id: meal.id,
    name: meal.name,
    nameEn: meal.nameEn,
    category: categoryEs(meal.category),
    area: areaEs(meal.area),
    image: found?.url ?? null,
    imageCredit: found?.credit ?? null,
    youtube: '',
    source: '',
    steps: meal.steps,
    translation: null,
    translationFailed: false,
    ingredients: meal.ingredients.map((ing) => {
      const staple = pantry && isStaple(ing.name);
      const s = stem(ing.name);
      return {
        name: ing.es,
        nameEn: ing.name,
        measure: ing.measure,
        have: staple || groups.some((g) => g.stems.some((x) => stemMatches(x, s))),
        staple,
      };
    }),
  };
}

export async function getRecipe(id, haveTerms = [], pantry = false) {
  await ensureCatalog().catch(() => {});
  const own = catalogMeal(id);
  if (own?.local) return getLocalRecipe(own, haveTerms, pantry);

  let meal = null;
  try {
    meal = await lookupMeal(id); // petición GET a lookup.php
  } catch (err) {
    if (err.status === 400) throw err;
    meal = own; // sin internet con TheMealDB, se usa la copia local
    if (!meal) throw err;
  }
  meal ??= own;
  if (!meal) throw new HttpError(404, 'No encontramos esa receta.');

  const groups = await resolveTerms(haveTerms);

  // "Ya lo tienes" se calcula con los nombres en inglés; la traducción es solo para mostrar.
  const marked = meal.ingredients.map((ing) => {
    const s = stem(ing.name);
    const staple = pantry && isStaple(ing.name);
    return { ...ing, staple, have: staple || groups.some((g) => g.stems.some((x) => stemMatches(x, s))) };
  });

  const unknownNames = [...new Set(marked.filter((i) => !ingredientEs(i.name)).map((i) => i.name))];
  const out = await translateMany([meal.name, ...unknownNames, ...meal.steps]);
  const name = out[0].trim();
  const viaApi = new Map(unknownNames.map((n, i) => [n, out[i + 1]]));
  const steps = out.slice(1 + unknownNames.length);

  let img = { url: meal.thumb || null, credit: null };
  if (config.preferUnsplash || !meal.thumb) {
    const found = await searchPhoto(meal.name);
    if (found) { trackUse(found); img = { url: found.url, credit: found.credit }; }
  }

  return {
    id: meal.id,
    name,
    nameEn: meal.name,
    category: categoryEs(meal.category),
    area: areaEs(meal.area),
    image: img.url,
    imageCredit: img.credit,
    youtube: meal.youtube,
    source: meal.source,
    steps: steps.map(poundsToMetric), // los pasos también pasan de libras a gramos o kilos
    translation: provider,
    // Si hay traductor pero ningún paso cambió, el servicio no respondió o agotó su límite: la pantalla lo avisa
    translationFailed: Boolean(provider) && meal.steps.length > 0 && steps.every((s, i) => s === meal.steps[i]),
    ingredients: marked.map((ing) => ({
      name: cap(ingredientEs(ing.name) ?? viaApi.get(ing.name) ?? ing.name),
      nameEn: ing.name,
      measure: measureEs(ing.measure),
      have: ing.have,
      staple: ing.staple,
    })),
  };
}

/** Receta al azar: petición GET a random.php; si TheMealDB no responde, se elige del catálogo local. */
export async function randomRecipeId() {
  const live = await randomMeal().catch(() => null);
  if (live) return live.id;
  await ensureCatalog();
  return randomCatalogMeal()?.id ?? null;
}

export async function recipeMeta() {
  await ensureCatalog();
  return { categories: listCategories(), peru: countByArea('Peruvian'), partial: isPartial() };
}

export const ingredientSuggestions = (q) => suggestIngredients(q);

export async function heroImage() {
  const photoInfo = await heroPhoto();
  if (!photoInfo) return null;
  trackUse(photoInfo);
  return { image: photoInfo.url, credit: photoInfo.credit };
}
