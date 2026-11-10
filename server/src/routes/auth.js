import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { getPool } from '../db.js';
import { requireAuth, requireDb, signToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { mailConfigured, sendMail } from '../services/mailer.js';
import { HttpError, wrap } from '../utils/http.js';

const router = Router();

// Configuración pública para la pantalla: el ID de cliente de Google no es secreto y así no hay que recompilar el frontend
router.get('/config', (req, res) => res.json({ googleClientId: config.googleClientId || null }));

router.use(requireDb);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v) => String(v ?? '').trim();

/** Valida con Google el token que entregó el botón "Continuar con Google" y devuelve los datos verificados de la persona. */
async function verifyGoogleToken(credential) {
  if (!config.googleClientId) throw new HttpError(503, 'El acceso con Google no está configurado en este servidor.');
  if (!credential || credential.length > 4096) throw new HttpError(400, 'No recibimos la credencial de Google.');

  let res;
  try {
    res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new HttpError(502, 'No pudimos verificar tu cuenta con Google en este momento. Inténtalo de nuevo en unos minutos.');
  }
  const info = await res.json().catch(() => null);
  const issuer = info?.iss === 'accounts.google.com' || info?.iss === 'https://accounts.google.com';
  const verified = info?.email_verified === true || info?.email_verified === 'true';
  // aud: el token debe haberse emitido para ESTA aplicación; si no, cualquier app de Google podría entrar con él
  if (!res.ok || !info || info.aud !== config.googleClientId || !issuer || Number(info.exp) * 1000 < Date.now() || !info.sub || !info.email || !verified) {
    throw new HttpError(401, 'Google no pudo verificar tu cuenta. Inténtalo de nuevo.');
  }
  const email = String(info.email).toLowerCase().slice(0, 160);
  const name = (text(info.name) || email.split('@')[0]).padEnd(2, ' ').slice(0, 80).trim();
  return { sub: String(info.sub).slice(0, 40), email, name };
}

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
    const user = { id: result.insertId, name, email, role: 'user' };
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
    'SELECT id, name, email, role, password_hash FROM users WHERE email = ?',
    [email],
  );
  const user = rows[0];
  if (user && !user.password_hash) throw new HttpError(401, 'Esta cuenta se creó con Google. Usa el botón “Continuar con Google”.');
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Correo o contraseña incorrectos.');

  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

// ---------- Recuperar contraseña ----------
// 1) POST /forgot { email }: manda por correo un enlace de un solo uso que vence en 1 hora. Siempre responde lo mismo,
//    exista o no la cuenta, para que nadie pueda averiguar qué correos están registrados.
// 2) POST /reset { token, password }: con el enlace, pone la contraseña nueva y abre la sesión.
// En la base solo se guarda el hash (SHA-256) del token: aunque alguien leyera la tabla, no podría usar los enlaces.
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const forgotLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 6, message: 'Pediste demasiados enlaces. Espera una hora e inténtalo de nuevo.' });

router.post('/forgot', forgotLimit, wrap(async (req, res) => {
  const email = text(req.body?.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 160) throw new HttpError(400, 'Escribe un correo válido.');
  if (config.isProd && !mailConfigured) throw new HttpError(503, 'La recuperación por correo todavía no está activada en este servidor.');

  const pool = getPool();
  const [rows] = await pool.execute('SELECT id, name FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (user) {
    // Si ya pidió un enlace hace menos de un minuto, no se manda otro (evita llenar su bandeja)
    const [recent] = await pool.execute('SELECT id FROM password_resets WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 MINUTE', [user.id]);
    if (!recent.length) {
      const token = randomBytes(32).toString('hex');
      await pool.execute('DELETE FROM password_resets WHERE user_id = ?', [user.id]); // los enlaces anteriores dejan de servir
      await pool.execute('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))', [user.id, sha256(token)]);
      const link = `${config.appUrl}/restablecer?token=${token}`;
      try {
        await sendMail({
          to: email,
          subject: 'Restablece tu contraseña de Smart Pocket Chef',
          text: `Hola, ${user.name.split(' ')[0]}.\n\nPara elegir una contraseña nueva abre este enlace (vence en 1 hora y solo sirve una vez):\n\n${link}\n\nSi no lo pediste tú, ignora este mensaje: tu contraseña no cambia.`,
          html: `<p>Hola, ${user.name.split(' ')[0].replace(/[<>&]/g, '')}.</p><p>Para elegir una contraseña nueva pulsa el botón. El enlace vence en 1 hora y solo sirve una vez.</p><p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#d4285f;color:#fff;border-radius:999px;text-decoration:none;font-weight:bold">Elegir contraseña nueva</a></p><p style="color:#476558">Si el botón no abre, copia esta dirección en tu navegador:<br>${link}</p><p style="color:#476558">Si no lo pediste tú, ignora este mensaje: tu contraseña no cambia.</p>`,
        });
      } catch (err) {
        // El fallo del correo queda en el registro; a la persona se le responde igual que siempre
        console.warn(`No se pudo enviar el correo de recuperación: ${err.message}`);
        await pool.execute('DELETE FROM password_resets WHERE user_id = ?', [user.id]);
      }
    }
  }
  res.json({ ok: true });
}));

router.post('/reset', wrap(async (req, res) => {
  const token = text(req.body?.token);
  const password = String(req.body?.password ?? '');
  if (password.length < 8 || password.length > 72) throw new HttpError(400, 'La contraseña debe tener entre 8 y 72 caracteres.');
  const expired = new HttpError(400, 'El enlace venció o ya se usó. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.');
  if (!/^[a-f0-9]{64}$/.test(token)) throw expired;

  const pool = getPool();
  const [rows] = await pool.execute('SELECT id, user_id FROM password_resets WHERE token_hash = ? AND expires_at > NOW()', [sha256(token)]);
  if (!rows[0]) throw expired;
  const hash = await bcrypt.hash(password, 10);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Borrar el token es lo que "lo gasta": si dos personas lo usan a la vez, solo una lo consigue
    const [claimed] = await conn.execute('DELETE FROM password_resets WHERE id = ?', [rows[0].id]);
    if (!claimed.affectedRows) throw expired;
    await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, rows[0].user_id]);
    await conn.execute('DELETE FROM password_resets WHERE user_id = ?', [rows[0].user_id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  const [[user]] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [rows[0].user_id]);
  res.json({ token: signToken(user), user });
}));

// POST /api/auth/google  { credential }  -> valida el token con Google, crea o enlaza la cuenta en MySQL y devuelve el JWT propio
router.post('/google', wrap(async (req, res) => {
  const google = await verifyGoogleToken(text(req.body?.credential));
  const pool = getPool();

  const [rows] = await pool.execute('SELECT id, name, email, role, google_id FROM users WHERE google_id = ? OR email = ?', [google.sub, google.email]);
  let user = rows.find((r) => r.google_id === google.sub) ?? rows[0];
  let isNew = false;

  if (!user) {
    const [result] = await pool.execute('INSERT INTO users (name, email, google_id, password_hash) VALUES (?, ?, ?, NULL)', [google.name, google.email, google.sub]);
    user = { id: result.insertId, name: google.name, email: google.email, role: 'user' };
    isNew = true;
  } else if (!user.google_id) {
    await pool.execute('UPDATE users SET google_id = ? WHERE id = ?', [google.sub, user.id]); // ya tenía cuenta con ese correo: se enlaza
  }
  res.status(isNew ? 201 : 200).json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role }, isNew });
}));

router.get('/me', requireAuth, wrap(async (req, res) => {
  const [rows] = await getPool().execute('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
  if (!rows[0]) throw new HttpError(401, 'Tu sesión ya no es válida.');
  res.json({ user: rows[0] });
}));

export default router;
