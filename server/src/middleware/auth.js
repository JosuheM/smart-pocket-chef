import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { isDbReady } from '../db.js';
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
