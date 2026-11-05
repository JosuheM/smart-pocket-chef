import { Router } from 'express';
import { config } from '../config.js';
import { buildQrUrl } from '../services/quickchart.js';
import { HttpError } from '../utils/http.js';

const router = Router();

// GET /api/share/qr?url=https://tu-sitio/?r=52772  -> { url, qrUrl }
// QuickChart (API 3) dibuja el QR del enlace de la receta. Solo se aceptan enlaces de la propia aplicación
// (CLIENT_ORIGIN): así este endpoint no sirve para generar QR de cualquier dirección.
router.get('/qr', (req, res, next) => {
  let url;
  try {
    url = new URL(String(req.query.url ?? ''));
  } catch {
    return next(new HttpError(400, 'El enlace para compartir no es válido.'));
  }
  if (!config.clientOrigin.includes(url.origin)) return next(new HttpError(400, 'Solo se pueden compartir enlaces de esta aplicación.'));
  const link = url.toString().slice(0, 300);
  res.json({ url: link, qrUrl: buildQrUrl(link, 320) });
});

export default router;
