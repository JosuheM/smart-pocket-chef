import { Router } from 'express';
import { getPool } from '../db.js';
import { requireAuth, requireDb } from '../middleware/auth.js';
import { pantryOverview } from '../services/mealdb.js';
import { parseDiet } from '../utils/diet.js';
import { HttpError, clampInt, wrap } from '../utils/http.js';

const router = Router();
router.use(requireDb, requireAuth);

const MAX_ITEMS = 60;
const squash = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

async function readPantry(userId) {
  const [rows] = await getPool().execute('SELECT ingredient FROM user_pantry WHERE user_id = ? ORDER BY ingredient', [userId]);
  return rows.map((r) => r.ingredient);
}

// GET /api/pantry  -> { items: ['pollo', 'arroz', ...] }
router.get('/', wrap(async (req, res) => {
  res.json({ items: await readPantry(req.user.id) });
}));

// PUT /api/pantry  { items: [...] }  -> reemplaza la despensa completa (en una transacción, para no dejarla a medias)
router.put('/', wrap(async (req, res) => {
  const raw = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!raw) throw new HttpError(400, 'Envía la lista de ingredientes de tu despensa.');
  const seen = new Set();
  const items = raw.map(squash).filter((name) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_ITEMS);

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM user_pantry WHERE user_id = ?', [req.user.id]);
    for (const name of items) await conn.execute('INSERT INTO user_pantry (user_id, ingredient) VALUES (?, ?)', [req.user.id, name]);
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  res.json({ items: await readPantry(req.user.id) });
}));

// GET /api/pantry/summary?diet=gluten&limit=12&offset=0
// -> { items, total, almost, results }: "Hoy puedes cocinar {total} recetas con lo que tienes"
router.get('/summary', wrap(async (req, res) => {
  const items = await readPantry(req.user.id);
  const summary = await pantryOverview(items, {
    diet: parseDiet(req.query.diet),
    limit: clampInt(req.query.limit, 12, 1, 24),
    offset: clampInt(req.query.offset, 0, 0, 2000),
  });
  res.json({ items, ...summary });
}));

export default router;
