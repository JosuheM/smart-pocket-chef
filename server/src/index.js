import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { initDb, isDbReady, keepTryingDb } from './db.js';
import { initCatalog, catalogSize } from './services/catalog.js';
import { provider } from './services/translate.js';
import { rateLimit } from './middleware/rateLimit.js';
import { serviceStatus } from './services/status.js';
import authRoutes from './routes/auth.js';
import recipeRoutes from './routes/recipes.js';
import favoriteRoutes from './routes/favorites.js';
import shoppingRoutes from './routes/shopping.js';

const app = express();
if (config.trustProxy) app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '50kb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: isDbReady(),
    unsplash: Boolean(config.unsplashKey),
    translation: provider,
    recipes: catalogSize(),
  });
});

app.get('/api/status', rateLimit({ windowMs: 60 * 1000, max: 12 }), async (req, res, next) => {
  try {
    res.json(await serviceStatus({ fresh: req.query.fresh === '1' }));
  } catch (err) {
    next(err);
  }
});
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.' }), authRoutes);
app.use('/api/recipes', rateLimit({ windowMs: 60 * 1000, max: 120 }), recipeRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/shopping', rateLimit({ windowMs: 60 * 1000, max: 60 }), shoppingRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido.' });
  const status = err.status || 500;
  if (status >= 500 && !err.expose) console.error(err);
  res.status(status).json({ error: err.expose ? err.message : 'Error interno del servidor.' });
});

// Sin "await" de nivel superior: Hostinger carga este archivo con require() y Node lo rechaza (ERR_REQUIRE_ASYNC_MODULE).
// El puerto se abre enseguida; la base y el catálogo se preparan a continuación (hasta entonces, las cuentas responden 503).
app.listen(config.port, () => {
  console.log(`Smart Pocket Chef API en http://localhost:${config.port}`);
});

// El catálogo y la base son independientes: el catálogo se lee de inmediato, sin esperar a MySQL.
initCatalog().catch((err) => console.error(`Error al cargar el catálogo: ${err.message}`));
initDb()
  .then(() => { if (!isDbReady()) keepTryingDb(); }) // sin base al arrancar: reintenta cada minuto
  .catch((err) => console.error(`Error al preparar la base: ${err.message}`));
