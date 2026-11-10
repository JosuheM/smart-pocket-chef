import { getPool } from '../db.js';
import { reloadCustomRecipes } from '../services/customRecipes.js';
import { spanishToEnglish } from '../utils/ingredients-es.js';
import { HttpError } from '../utils/http.js';
import { CATEGORIES } from '../utils/spanish.js';
import { normalize } from '../utils/text.js';

// Gestión de las recetas propias (comida peruana, tabla custom_recipes). Cada cambio se refleja enseguida en el buscador.

const FIRST_ID = 900000; // los ids propios empiezan en 900001 para no chocar con los de TheMealDB
const MAX_INGREDIENTS = 40;
const MAX_STEPS = 30;

const squash = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const parse = (text, fallback) => {
  try { return JSON.parse(text) ?? fallback; } catch { return fallback; }
};

const recipeId = (value) => {
  if (!/^\d{1,10}$/.test(String(value))) throw new HttpError(400, 'Identificador de receta inválido.');
  return String(value);
};

const audit = (req, action) => console.log(`[admin] usuario ${req.user.id}: ${action}`);

/**
 * Valida y limpia lo que envía el formulario. El nombre en inglés de cada ingrediente (`name`) es la clave con la que el
 * buscador lo cruza con lo que escribe la gente ("pollo" -> chicken); si se deja vacío se toma del diccionario.
 */
export function cleanRecipe(body = {}) {
  const name = squash(body.name);
  if (name.length < 2 || name.length > 160) throw new HttpError(400, 'El nombre del plato debe tener entre 2 y 160 caracteres.');
  const category = String(body.category ?? '');
  if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Elige una categoría válida.');

  const rawIngredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  const ingredients = rawIngredients
    .map((i) => ({ es: squash(i?.es).slice(0, 80), measure: squash(i?.measure).slice(0, 60), key: squash(i?.name).toLowerCase().slice(0, 80) }))
    .filter((i) => i.es)
    .map(({ es, measure, key }) => ({ name: key || spanishToEnglish(es)?.[0] || normalize(es), es, measure }));
  if (!ingredients.length) throw new HttpError(400, 'Agrega al menos un ingrediente.');
  if (rawIngredients.length > MAX_INGREDIENTS) throw new HttpError(400, `Una receta admite hasta ${MAX_INGREDIENTS} ingredientes.`);

  const rawSteps = Array.isArray(body.steps) ? body.steps : [];
  const steps = rawSteps.map((s) => squash(s).slice(0, 700)).filter(Boolean);
  if (!steps.length) throw new HttpError(400, 'Agrega al menos un paso de preparación.');
  if (rawSteps.length > MAX_STEPS) throw new HttpError(400, `Una receta admite hasta ${MAX_STEPS} pasos.`);

  return {
    name,
    nameEn: squash(body.nameEn).slice(0, 160) || name,
    category,
    photo: squash(body.photo).slice(0, 160) || name, // búsqueda de la foto en Unsplash
    ingredients,
    steps,
  };
}

const toJson = (r) => ({
  id: r.id,
  name: r.name,
  nameEn: r.name_en,
  category: r.category,
  photo: r.photo_query ?? '',
  ingredients: parse(r.ingredients, []),
  steps: parse(r.steps, []),
  fixedPhoto: Boolean(r.picture),
  updatedAt: r.updated_at,
});

/** GET /api/admin/recipes */
export async function listRecipes(req, res) {
  const [rows] = await getPool().query('SELECT * FROM custom_recipes ORDER BY CAST(id AS UNSIGNED)');
  res.json({
    total: rows.length,
    recipes: rows.map((r) => {
      const full = toJson(r);
      return { id: full.id, name: full.name, category: full.category, ingredients: full.ingredients.length, steps: full.steps.length, fixedPhoto: full.fixedPhoto, updatedAt: full.updatedAt };
    }),
  });
}

/** GET /api/admin/recipes/:id */
export async function getRecipeById(req, res) {
  const [rows] = await getPool().execute('SELECT * FROM custom_recipes WHERE id = ?', [recipeId(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Esa receta ya no existe.');
  res.json(toJson(rows[0]));
}

/** POST /api/admin/recipes */
export async function createRecipe(req, res) {
  const r = cleanRecipe(req.body);
  const [[{ next }]] = await getPool().query('SELECT COALESCE(MAX(CAST(id AS UNSIGNED)), ?) + 1 AS next FROM custom_recipes', [FIRST_ID]);
  const id = String(next);
  await getPool().execute(
    `INSERT INTO custom_recipes (id, name, name_en, category, area, photo_query, picture, ingredients, steps)
     VALUES (?, ?, ?, ?, 'Peruvian', ?, NULL, ?, ?)`,
    [id, r.name, r.nameEn, r.category, r.photo, JSON.stringify(r.ingredients), JSON.stringify(r.steps)],
  );
  await reloadCustomRecipes();
  audit(req, `agregó la receta "${r.name}" (id ${id})`);
  res.status(201).json({ id });
}

/** PUT /api/admin/recipes/:id  (la foto fija, si la tiene, no se toca) */
export async function updateRecipe(req, res) {
  const id = recipeId(req.params.id);
  const r = cleanRecipe(req.body);
  const [result] = await getPool().execute(
    `UPDATE custom_recipes SET name = ?, name_en = ?, category = ?, photo_query = ?, ingredients = ?, steps = ? WHERE id = ?`,
    [r.name, r.nameEn, r.category, r.photo, JSON.stringify(r.ingredients), JSON.stringify(r.steps), id],
  );
  if (!result.affectedRows) {
    const [exists] = await getPool().execute('SELECT id FROM custom_recipes WHERE id = ?', [id]); // sin cambios también devuelve 0 en algunos servidores
    if (!exists[0]) throw new HttpError(404, 'Esa receta ya no existe.');
  }
  await reloadCustomRecipes();
  audit(req, `corrigió la receta "${r.name}" (id ${id})`);
  res.json({ id });
}

/** DELETE /api/admin/recipes/:id  (también quita esa receta de las favoritas y notas de la gente) */
export async function deleteRecipe(req, res) {
  const id = recipeId(req.params.id);
  const pool = getPool();
  const [rows] = await pool.execute('SELECT name FROM custom_recipes WHERE id = ?', [id]);
  if (!rows[0]) throw new HttpError(404, 'Esa receta ya no existe.');
  await pool.execute('DELETE FROM custom_recipes WHERE id = ?', [id]);
  await pool.execute('DELETE FROM favorites WHERE meal_id = ?', [id]);
  await pool.execute('DELETE FROM recipe_notes WHERE meal_id = ?', [id]);
  await reloadCustomRecipes();
  audit(req, `borró la receta "${rows[0].name}" (id ${id})`);
  res.status(204).end();
}
