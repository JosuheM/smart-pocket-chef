import { getPool, isDbReady } from '../db.js';
import { prepareMeals } from './catalog.js';

/**
 * Recetas que cada persona crea para sí misma (tabla user_recipes). Solo las ve su dueña o dueño: ni el buscador público
 * ni el catálogo las incluyen; se suman a sus propias búsquedas, a su despensa y a su plan semanal.
 *
 * Para que el resto de la app (favoritas, notas, plan, ?r=) siga trabajando con ids numéricos, el id público de una
 * receta propia es MY_BASE + el id de la fila. Los de TheMealDB llegan a ~53000 y los peruanos empiezan en 900001.
 */
export const MY_BASE = 10_000_000;
export const MAX_PER_USER = 50;

export const toPublicId = (rowId) => String(MY_BASE + Number(rowId));
export const isMyId = (id) => /^\d{1,12}$/.test(String(id)) && Number(id) >= MY_BASE;
export const toRowId = (id) => (isMyId(id) ? Number(id) - MY_BASE : null);

const parse = (text, fallback) => {
  try { return JSON.parse(text) ?? fallback; } catch { return fallback; }
};

/** La fila de MySQL con la forma de una receta del catálogo (local: ya está en español, sin foto). */
export const rowToMeal = (r) => ({
  id: toPublicId(r.id),
  name: r.name,
  nameEn: r.name,
  category: r.category,
  area: 'Mi receta',
  photo: '',
  picture: null,
  local: true,
  mine: true,
  noPhoto: true, // no se busca foto en Unsplash: no gasta cuota ni muestra imágenes ajenas a lo que la persona escribió
  thumb: '',
  youtube: '',
  source: '',
  ingredients: parse(r.ingredients, []),
  steps: parse(r.steps, []),
});

export async function getUserRow(userId, publicId) {
  const rowId = toRowId(publicId);
  if (rowId === null) return null;
  const [rows] = await getPool().execute('SELECT * FROM user_recipes WHERE id = ? AND user_id = ?', [rowId, userId]);
  return rows[0] ?? null;
}

/** Las recetas de una persona, ya preparadas para mezclarse con el catálogo en sus búsquedas. Sin sesión o sin base: ninguna. */
export async function userMeals(userId) {
  if (!userId || !isDbReady()) return [];
  try {
    const [rows] = await getPool().execute('SELECT * FROM user_recipes WHERE user_id = ? ORDER BY id', [userId]);
    return prepareMeals(rows.map(rowToMeal).filter((m) => m.ingredients.length && m.steps.length));
  } catch (err) {
    console.warn(`No se pudieron leer las recetas propias del usuario ${userId}: ${err.message}`);
    return [];
  }
}
