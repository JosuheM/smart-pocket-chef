import { Router } from 'express';
import { getPool } from '../db.js';
import { requireAuth, requireDb } from '../middleware/auth.js';
import { HttpError, wrap } from '../utils/http.js';

const router = Router();
router.use(requireDb, requireAuth);

const MAX_NOTE = 1000;
const validId = (id) => /^\d{1,20}$/.test(String(id ?? ''));

const toJson = (r) => ({
  mealId: r.meal_id, name: r.name, image: r.image, note: r.note ?? '', rating: r.rating, cooked: Boolean(r.cooked), cookedAt: r.cooked_at, updatedAt: r.updated_at,
});

// GET /api/notes  -> las recetas con nota, calificación o marcadas como cocinadas (la más reciente primero)
router.get('/', wrap(async (req, res) => {
  const [rows] = await getPool().execute(
    'SELECT meal_id, name, image, note, rating, cooked, cooked_at, updated_at FROM recipe_notes WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 200',
    [req.user.id],
  );
  res.json(rows.map(toJson));
}));

// GET /api/notes/52772  -> { note, rating, cooked } de esa receta (vacío si aún no hay nada)
router.get('/:mealId', wrap(async (req, res) => {
  if (!validId(req.params.mealId)) throw new HttpError(400, 'Identificador de receta inválido.');
  const [rows] = await getPool().execute(
    'SELECT meal_id, name, image, note, rating, cooked, cooked_at, updated_at FROM recipe_notes WHERE user_id = ? AND meal_id = ?',
    [req.user.id, req.params.mealId],
  );
  res.json(rows[0] ? toJson(rows[0]) : { mealId: req.params.mealId, note: '', rating: null, cooked: false });
}));

// PUT /api/notes/52772  { note, rating (1-5 o null), cooked, name, image }
router.put('/:mealId', wrap(async (req, res) => {
  if (!validId(req.params.mealId)) throw new HttpError(400, 'Identificador de receta inválido.');
  const body = req.body ?? {};
  const note = String(body.note ?? '').trim().slice(0, MAX_NOTE);
  const rating = body.rating === null || body.rating === undefined || body.rating === 0 ? null : Number(body.rating);
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new HttpError(400, 'La calificación va de 1 a 5 estrellas.');
  const cooked = body.cooked === true || body.cooked === 1 || body.cooked === '1';

  // Sin nota, sin calificación y sin marcar: no hay nada que guardar
  if (!note && rating === null && !cooked) {
    await getPool().execute('DELETE FROM recipe_notes WHERE user_id = ? AND meal_id = ?', [req.user.id, req.params.mealId]);
    res.json({ mealId: req.params.mealId, note: '', rating: null, cooked: false });
    return;
  }

  const name = String(body.name ?? '').trim().slice(0, 160) || null;
  const image = body.image ? String(body.image).slice(0, 500) : null;
  // cooked_at guarda cuándo se marcó por primera vez como cocinada; al desmarcarla se borra
  await getPool().execute(
    `INSERT INTO recipe_notes (user_id, meal_id, name, image, note, rating, cooked, cooked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ${cooked ? 'NOW()' : 'NULL'})
     ON DUPLICATE KEY UPDATE
       name = COALESCE(VALUES(name), name), image = COALESCE(VALUES(image), image),
       note = VALUES(note), rating = VALUES(rating),
       cooked_at = ${cooked ? 'IF(cooked = 1, cooked_at, NOW())' : 'NULL'},
       cooked = VALUES(cooked)`,
    [req.user.id, req.params.mealId, name, image, note || null, rating, cooked ? 1 : 0],
  );
  const [rows] = await getPool().execute(
    'SELECT meal_id, name, image, note, rating, cooked, cooked_at, updated_at FROM recipe_notes WHERE user_id = ? AND meal_id = ?',
    [req.user.id, req.params.mealId],
  );
  res.json(toJson(rows[0]));
}));

export default router;
