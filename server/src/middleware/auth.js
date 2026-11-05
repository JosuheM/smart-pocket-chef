import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getPool, isDbReady } from '../db.js';
import { HttpError } from '../utils/http.js';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, name: user.name }, config.jwtSecret, { expiresIn: '7d' });

function readUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    return { id: payload.sub };
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const user = readUser(req);
  if (!user) return next(new HttpError(401, 'Inicia sesión para continuar.'));
  req.user = user;
  next();
}

/**
 * Va DESPUÉS de requireAuth. El rol se consulta en la base en cada petición y no se lee del token: así, si a alguien le
 * quitan el rol de administrador (o borran su cuenta), pierde el acceso al instante aunque su token siga sin vencer.
 */
export async function verifyAdmin(req, res, next) {
  try {
    const [rows] = await getPool().execute('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (!rows[0]) return next(new HttpError(401, 'Tu sesión ya no es válida.'));
    if (rows[0].role !== 'admin') return next(new HttpError(403, 'No tienes permiso para entrar a esta sección.'));
    next();
  } catch (err) {
    next(err);
  }
}

/** Si hay sesión válida llena req.user; si no, deja pasar como visitante. */
export function optionalAuth(req, res, next) {
  req.user = readUser(req);
  next();
}

export function requireDb(req, res, next) {
  if (!isDbReady()) {
    return next(new HttpError(503, 'Las cuentas no están disponibles: no hay conexión con la base de datos.'));
  }
  next();
}
