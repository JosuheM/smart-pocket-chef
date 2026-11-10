import { Router } from 'express';
import { getPool, isDbReady } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { planMeal } from '../services/mealdb.js';
import { buildShoppingList } from '../services/quickchart.js';
import { HttpError, mapLimit, wrap } from '../utils/http.js';

const router = Router();

const MIN_MEALS = 3;
const MAX_MEALS = 7;
const SERVINGS = [2, 4, 6];

// POST /api/plan/shopping  { meals: [{ id: "52772", servings: 4 }, ...] }   (de 3 a 7 recetas)
// Une los ingredientes de todas las recetas (las medidas iguales se suman), arma un solo texto y pide un solo QR a QuickChart.
router.post('/shopping', optionalAuth, wrap(async (req, res) => {
  const raw = Array.isArray(req.body?.meals) ? req.body.meals : [];
  const seen = new Set();
  const meals = raw
    .map((m) => ({ id: String(m?.id ?? ''), servings: SERVINGS.includes(Number(m?.servings)) ? Number(m.servings) : 2 }))
    .filter((m) => /^\d{1,20}$/.test(m.id) && !seen.has(m.id) && seen.add(m.id));
  if (meals.length < MIN_MEALS || meals.length > MAX_MEALS) {
    throw new HttpError(400, `Elige entre ${MIN_MEALS} y ${MAX_MEALS} recetas para armar el plan de la semana.`);
  }

  const planned = await mapLimit(meals, 3, (m) => planMeal(m.id, m.servings, req.user?.id));
  const items = planned.flatMap((p) => p.ingredients);
  const list = buildShoppingList(items, 'Compra semanal', { maxText: 1400 });

  let saved = false;
  if (req.user && isDbReady()) {
    try {
      await getPool().execute(
        'INSERT INTO shopping_lists (user_id, recipe_id, recipe_name, items) VALUES (?, NULL, ?, ?)',
        [req.user.id, `Plan semanal (${planned.length} recetas)`, JSON.stringify(list.items)],
      );
      saved = true;
    } catch (err) {
      console.warn(`No se pudo guardar el plan en el historial: ${err.message}`);
    }
  }
  res.json({ ...list, saved, meals: planned.map((p, i) => ({ id: p.id, name: p.name, servings: meals[i].servings })) });
}));

export default router;
