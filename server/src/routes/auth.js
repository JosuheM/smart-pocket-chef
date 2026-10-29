import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '../db.js';
import { requireAuth, requireDb, signToken } from '../middleware/auth.js';
import { HttpError, wrap } from '../utils/http.js';

const router = Router();
router.use(requireDb);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v) => String(v ?? '').trim();

router.post('/register', wrap(async (req, res) => {
  const name = text(req.body?.name);
  const email = text(req.body?.email).toLowerCase();
  const password = String(req.body?.password ?? '');

  if (name.length < 2 || name.length > 80) throw new HttpError(400, 'Escribe tu nombre (entre 2 y 80 caracteres).');
  if (!EMAIL_RE.test(email) || email.length > 160) throw new HttpError(400, 'Escribe un correo válido.');
  if (password.length < 8 || password.length > 72) throw new HttpError(400, 'La contraseña debe tener entre 8 y 72 caracteres.');

  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await getPool().execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hash],
    );
    const user = { id: result.insertId, name, email };
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ya existe una cuenta con ese correo.');
    throw err;
  }
}));

router.post('/login', wrap(async (req, res) => {
  const email = text(req.body?.email).toLowerCase();
  const password = String(req.body?.password ?? '');

  const [rows] = await getPool().execute(
    'SELECT id, name, email, password_hash FROM users WHERE email = ?',
    [email],
  );
  const user = rows[0];
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Correo o contraseña incorrectos.');

  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email } });
}));

router.get('/me', requireAuth, wrap(async (req, res) => {
  const [rows] = await getPool().execute('SELECT id, name, email FROM users WHERE id = ?', [req.user.id]);
  if (!rows[0]) throw new HttpError(401, 'Tu sesión ya no es válida.');
  res.json({ user: rows[0] });
}));

export default router;
