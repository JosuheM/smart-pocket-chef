import { getPool } from '../db.js';
import { HttpError, clampInt } from '../utils/http.js';

const ROLES = ['user', 'admin'];

const userId = (value) => {
  if (!/^\d{1,10}$/.test(String(value))) throw new HttpError(400, 'Identificador de usuario inválido.');
  return Number(value);
};

const adminCount = async () => {
  const [[row]] = await getPool().query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
  return row.n;
};

const audit = (req, action) => console.log(`[admin] usuario ${req.user.id}: ${action}`); // queda en el registro del servidor

/** GET /api/admin/users?search=ana&limit=25&offset=0 */
export async function listUsers(req, res) {
  const limit = clampInt(req.query.limit, 25, 1, 100);
  const offset = clampInt(req.query.offset, 0, 0, 100000);
  const search = String(req.query.search ?? '').trim().slice(0, 60);
  const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`; // los comodines escritos por el admin se toman como texto

  const where = search ? 'WHERE u.name LIKE ? OR u.email LIKE ?' : '';
  const args = search ? [like, like] : [];
  const pool = getPool();
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users u ${where}`, args);
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at,
            (u.google_id IS NOT NULL) AS has_google, (u.password_hash IS NOT NULL) AS has_password,
            (SELECT COUNT(*) FROM user_pantry p WHERE p.user_id = u.id) AS pantry_items,
            (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) AS favorites
       FROM users u ${where}
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );

  res.json({
    total,
    hasMore: offset + limit < total,
    users: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      createdAt: r.created_at,
      google: Boolean(r.has_google),
      password: Boolean(r.has_password),
      pantryItems: r.pantry_items,
      favorites: r.favorites,
    })),
  });
}

/** PUT /api/admin/users/:id/role  { role: 'admin' | 'user' } */
export async function setUserRole(req, res) {
  const id = userId(req.params.id);
  const role = String(req.body?.role ?? '');
  if (!ROLES.includes(role)) throw new HttpError(400, 'El rol debe ser "user" o "admin".');
  if (id === req.user.id) throw new HttpError(400, 'No puedes cambiar tu propio rol: otro administrador debe hacerlo.');

  const pool = getPool();
  const [rows] = await pool.execute('SELECT id, email, role FROM users WHERE id = ?', [id]);
  if (!rows[0]) throw new HttpError(404, 'Ese usuario ya no existe.');
  if (rows[0].role === 'admin' && role === 'user' && (await adminCount()) <= 1) {
    throw new HttpError(409, 'Debe quedar al menos un administrador.');
  }
  await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  audit(req, `cambió el rol de ${rows[0].email} (id ${id}) a ${role}`);
  res.json({ id, role });
}

/** DELETE /api/admin/users/:id  (sus favoritas, despensa, notas e historial se borran con él: ON DELETE CASCADE) */
export async function deleteUser(req, res) {
  const id = userId(req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'No puedes eliminar tu propia cuenta desde el panel.');

  const pool = getPool();
  const [rows] = await pool.execute('SELECT id, email, role FROM users WHERE id = ?', [id]);
  if (!rows[0]) throw new HttpError(404, 'Ese usuario ya no existe.');
  if (rows[0].role === 'admin' && (await adminCount()) <= 1) throw new HttpError(409, 'Debe quedar al menos un administrador.');

  await pool.execute('DELETE FROM users WHERE id = ?', [id]);
  audit(req, `eliminó la cuenta de ${rows[0].email} (id ${id})`);
  res.status(204).end();
}

/** GET /api/admin/stats */
export async function getStats(req, res) {
  const [[s]] = await getPool().query(
    `SELECT
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins,
       (SELECT COUNT(*) FROM users WHERE google_id IS NOT NULL) AS google_users,
       (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL 7 DAY) AS new_this_week,
       (SELECT COUNT(DISTINCT user_id) FROM user_pantry) AS pantries,
       (SELECT COUNT(*) FROM user_pantry) AS pantry_items,
       (SELECT COUNT(*) FROM favorites) AS favorites,
       (SELECT COUNT(*) FROM recipe_notes) AS notes,
       (SELECT COUNT(*) FROM recipe_notes WHERE cooked = 1) AS cooked,
       (SELECT COUNT(*) FROM shopping_lists) AS shopping_lists,
       (SELECT COUNT(*) FROM custom_recipes) AS custom_recipes,
       (SELECT COUNT(*) FROM user_recipes) AS user_recipes`,
  );
  res.json({
    users: s.users,
    admins: s.admins,
    googleUsers: s.google_users,
    newThisWeek: s.new_this_week,
    pantries: s.pantries,
    pantryItems: s.pantry_items,
    favorites: s.favorites,
    notes: s.notes,
    cooked: s.cooked,
    shoppingLists: s.shopping_lists,
    customRecipes: s.custom_recipes,
    userRecipes: s.user_recipes,
  });
}
