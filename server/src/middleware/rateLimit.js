import { HttpError } from '../utils/http.js';

/**
 * Limitador sencillo en memoria (ventana fija por IP). Protege el inicio de sesión de la fuerza bruta
 * y las cuotas de las APIs externas de un uso excesivo.
 */
export function rateLimit({ windowMs, max, message = 'Demasiadas peticiones. Espera un momento e inténtalo otra vez.' }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    res.setHeader('RateLimit-Remaining', Math.max(0, max - entry.count));
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return next(new HttpError(429, message));
    }
    next();
  };
}
