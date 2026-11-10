import { getPool } from '../db.js';
import { getUserRecipe } from '../services/mealdb.js';
import { MAX_PER_USER, getUserRow, rowToMeal, toPublicId, toRowId } from '../services/userRecipes.js';
import { HttpError } from '../utils/http.js';
import { categoryEs } from '../utils/spanish.js';
import { cleanRecipe } from './adminRecipesController.js';

// Recetas que cada persona crea para sí misma. Todas las consultas filtran por el usuario de la sesión (req.user.id):
// pedir el id de una receta ajena responde 404, igual que si no existiera.

const rowId = (id) => {
  const n = toRowId(id);
  if (n === null) throw new HttpError(404, 'No encontramos esa receta.');
  return n;
};
const list = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** GET /api/my/recipes -> tarjetas de mis recetas (con la misma forma que las del buscador) */
export async function listMine(req, res) {
  const [rows] = await getPool().execute('SELECT * FROM user_recipes WHERE user_id = ? ORDER BY updated_at DESC, id DESC', [req.user.id]);
  res.json({
    total: rows.length,
    max: MAX_PER_USER,
    recipes: rows.map((r) => {
      const m = rowToMeal(r);
      return { id: m.id, name: m.name, category: categoryEs(m.category), area: m.area, image: null, ingredients: m.ingredients.length, steps: m.steps.length, updatedAt: r.updated_at };
    }),
  });
}

/** GET /api/my/recipes/:id/edit -> los campos del formulario para corregirla */
export async function editMine(req, res) {
  const row = await getUserRow(req.user.id, req.params.id);
  if (!row) throw new HttpError(404, 'No encontramos esa receta.');
  const m = rowToMeal(row);
  res.json({ id: m.id, name: m.name, category: m.category, ingredients: m.ingredients.map((i) => ({ es: i.es, measure: i.measure, name: i.name })), steps: m.steps });
}

/** GET /api/my/recipes/:id?have=pollo,ajo&pantry=1 -> la receta completa, como la del buscador */
export async function showMine(req, res) {
  res.json(await getUserRecipe(req.user.id, req.params.id, list(req.query.have), req.query.pantry === '1' || req.query.pantry === 'true'));
}

/** POST /api/my/recipes */
export async function createMine(req, res) {
  const r = cleanRecipe(req.body);
  const pool = getPool();
  const [[{ n }]] = await pool.execute('SELECT COUNT(*) AS n FROM user_recipes WHERE user_id = ?', [req.user.id]);
  if (n >= MAX_PER_USER) throw new HttpError(409, `Puedes guardar hasta ${MAX_PER_USER} recetas propias. Borra alguna para agregar otra.`);
  const [result] = await pool.execute(
    'INSERT INTO user_recipes (user_id, name, category, ingredients, steps) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, r.name, r.category, JSON.stringify(r.ingredients), JSON.stringify(r.steps)],
  );
  res.status(201).json({ id: toPublicId(result.insertId) });
}

/** PUT /api/my/recipes/:id */
export async function updateMine(req, res) {
  const id = rowId(req.params.id);
  const r = cleanRecipe(req.body);
  const pool = getPool();
  const [result] = await pool.execute(
    'UPDATE user_recipes SET name = ?, category = ?, ingredients = ?, steps = ? WHERE id = ? AND user_id = ?',
    [r.name, r.category, JSON.stringify(r.ingredients), JSON.stringify(r.steps), id, req.user.id],
  );
  if (!result.affectedRows) throw new HttpError(404, 'No encontramos esa receta.');
  res.json({ id: toPublicId(id) });
}

/** DELETE /api/my/recipes/:id (también quita esa receta de sus favoritas y notas) */
export async function deleteMine(req, res) {
  const id = rowId(req.params.id);
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM user_recipes WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!result.affectedRows) throw new HttpError(404, 'No encontramos esa receta.');
  const publicId = toPublicId(id);
  await pool.execute('DELETE FROM favorites WHERE user_id = ? AND meal_id = ?', [req.user.id, publicId]);
  await pool.execute('DELETE FROM recipe_notes WHERE user_id = ? AND meal_id = ?', [req.user.id, publicId]);
  res.status(204).end();
}
