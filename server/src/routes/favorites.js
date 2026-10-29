import { Router } from 'express';
import { getPool } from '../db.js';
import { requireAuth, requireDb } from '../middleware/auth.js';
import { HttpError, wrap } from '../utils/http.js';

const router = Router();
router.use(requireDb, requireAuth);

router.get('/', wrap(async (req, res) => {
  const [rows] = await getPool().execute(
    'SELECT meal_id, name, image, category, area FROM favorites WHERE user_id = ? ORDER BY created_at DESC, id DESC',
    [req.user.id],
  );
  res.json(rows.map((r) => ({ mealId: r.meal_id, name: r.name, image: r.image, category: r.category, area: r.area })));
}));

router.post('/', wrap(async (req, res) => {
  const { mealId, name, image, category, area } = req.body ?? {};
  if (!/^\d{1,20}$/.test(String(mealId ?? '')) || !String(name ?? '').trim()) {
    throw new HttpError(400, 'Datos de receta incompletos.');
  }
  await getPool().execute(
    `INSERT INTO favorites (user_id, meal_id, name, image, category, area) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), image = VALUES(image)`,
    [
      req.user.id,
      String(mealId),
      String(name).slice(0, 160),
      image ? String(image).slice(0, 500) : null,
      category ? String(category).slice(0, 80) : null,
      area ? String(area).slice(0, 80) : null,
    ],
  );
  res.status(201).json({ ok: true });
}));

router.delete('/:mealId', wrap(async (req, res) => {
  await getPool().execute('DELETE FROM favorites WHERE user_id = ? AND meal_id = ?', [req.user.id, req.params.mealId]);
  res.status(204).end();
}));

export default router;
