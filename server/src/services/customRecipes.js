import { getPool, isDbReady } from '../db.js';
import { PERU } from '../data/peru.js';
import { PHOTOS } from '../data/peru-photos.js';
import { setCustomRecipes } from './catalog.js';

/**
 * Recetas propias en MySQL (tabla custom_recipes). TheMealDB casi no trae comida peruana, así que los 25 platos de
 * data/peru.js se guardan en la base y el catálogo los mezcla con los de TheMealDB: la pantalla no distingue el origen.
 * Si MySQL no responde, el catálogo usa el mismo archivo (data/peru.js) como copia de seguridad.
 */

const parse = (text, fallback) => {
  try { return JSON.parse(text) ?? fallback; } catch { return fallback; }
};

const toRow = (m) => [
  m.id, m.name, m.nameEn, m.category, m.area, m.photo ?? null,
  m.picture ? JSON.stringify(m.picture) : null,
  JSON.stringify(m.ingredients), JSON.stringify(m.steps),
];

/**
 * Inserta los platos de data/peru.js que falten. Con `force` también actualiza los que ya están
 * (útil después de corregir una receta en el archivo: `npm run seed -- --force`).
 */
export async function seedPeruvian({ force = false } = {}) {
  const pool = getPool();
  const columns = 'id, name, name_en, category, area, photo_query, picture, ingredients, steps';
  const update = force
    ? ` ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en), category = VALUES(category), area = VALUES(area),
        photo_query = VALUES(photo_query), picture = VALUES(picture), ingredients = VALUES(ingredients), steps = VALUES(steps)`
    : '';
  const verb = force ? 'INSERT' : 'INSERT IGNORE';
  let changed = 0;
  for (const meal of PERU) {
    const [result] = await pool.execute(`${verb} INTO custom_recipes (${columns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)${update}`, toRow(meal));
    changed += result.affectedRows > 0 ? 1 : 0;
  }
  return changed;
}

const fromRow = (r) => ({
  id: String(r.id),
  name: r.name,
  nameEn: r.name_en,
  category: r.category,
  area: r.area,
  photo: r.photo_query ?? '',
  picture: parse(r.picture, null) ?? PHOTOS[r.id] ?? null,
  local: true,
  thumb: '',
  youtube: '',
  source: '',
  ingredients: parse(r.ingredients, []),
  steps: parse(r.steps, []),
});

/**
 * Vuelve a leer las recetas propias de MySQL y se las entrega al catálogo (el buscador las usa al instante).
 * Se llama al arrancar y cada vez que el administrador agrega, corrige o borra un plato.
 */
export async function reloadCustomRecipes() {
  const [rows] = await getPool().query('SELECT * FROM custom_recipes ORDER BY CAST(id AS UNSIGNED)');
  const meals = rows.map(fromRow).filter((m) => m.ingredients.length && m.steps.length);
  setCustomRecipes(meals);
  return meals.length;
}

/**
 * Al arrancar: si la tabla está vacía (primera vez) se siembra con data/peru.js y luego se carga en el catálogo.
 * No se vuelve a sembrar con la tabla llena: así un plato que el administrador borró o corrigió no reaparece ni se pisa.
 */
export async function syncCustomRecipes() {
  if (!isDbReady()) return 0;
  const [[{ n }]] = await getPool().query('SELECT COUNT(*) AS n FROM custom_recipes');
  if (n === 0) await seedPeruvian();
  const count = await reloadCustomRecipes();
  console.log(`Recetas propias cargadas desde MySQL: ${count}.`);
  return count;
}
