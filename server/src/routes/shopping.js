import { Router } from 'express';
import { getPool, isDbReady } from '../db.js';
import { optionalAuth, requireAuth, requireDb } from '../middleware/auth.js';
import { buildShoppingList } from '../services/quickchart.js';
import { HttpError, wrap } from '../utils/http.js';

const router = Router();

// POST /api/shopping/qr  { recipeId, recipeName, items: [{ name, measure }] }
// Limpia la lista, arma el texto, construye la URL de QuickChart y, si hay sesión, la guarda en el historial.
router.post('/qr', optionalAuth, wrap(async (req, res) => {
  const { recipeId, recipeName, items } = req.body ?? {};
  const title = String(recipeName ?? '').trim().slice(0, 160);
  const list = buildShoppingList(items, title);
  if (!list.items.length) throw new HttpError(400, 'Selecciona al menos un ingrediente para la lista.');

  let saved = false;
  if (req.user && isDbReady()) {
    try {
      await getPool().execute(
        'INSERT INTO shopping_lists (user_id, recipe_id, recipe_name, items) VALUES (?, ?, ?, ?)',
        [req.user.id, String(recipeId ?? '').slice(0, 20) || null, title || null, JSON.stringify(list.items)],
      );
      saved = true;
    } catch (err) {
      console.warn(`No se pudo guardar el historial: ${err.message}`);
    }
  }
  res.json({ ...list, saved });
}));

router.get('/history', requireDb, requireAuth, wrap(async (req, res) => {
  const [rows] = await getPool().execute(
    'SELECT id, recipe_id, recipe_name, items, created_at FROM shopping_lists WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50',
    [req.user.id],
  );
  res.json(rows.map((r) => {
    let items = [];
    try { items = JSON.parse(r.items); } catch { /* fila dañada: se muestra vacía */ }
    const list = buildShoppingList(items, r.recipe_name ?? '');
    return { id: r.id, recipeId: r.recipe_id, recipeName: r.recipe_name, createdAt: r.created_at, ...list };
  }));
}));

router.delete('/history/:id', requireDb, requireAuth, wrap(async (req, res) => {
  await getPool().execute('DELETE FROM shopping_lists WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.status(204).end();
}));

export default router;
