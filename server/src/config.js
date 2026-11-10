import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET) {
  if (isProd) throw new Error('JWT_SECRET es obligatorio en producción. Define una cadena larga y aleatoria en las variables de entorno.');
  console.warn('JWT_SECRET no está definido en .env; se usa un valor de desarrollo.');
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  trustProxy: process.env.TRUST_PROXY === 'true', // true detrás de Render, Railway, Hostinger, etc.
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-cambialo',
  // Dirección pública del frontend: los enlaces de los correos (recuperar contraseña) apuntan ahí
  appUrl: (process.env.APP_URL || (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0]).trim().replace(/\/$/, ''),
  // Correo saliente (recuperar contraseña). Sin SMTP_HOST, en desarrollo el enlace se imprime en la consola del servidor.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || process.env.SMTP_USER || '',
  },
  // ID de cliente de Google (Google Cloud Console > Credenciales). Sin él, el botón "Continuar con Google" no aparece.
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  unsplashKey: process.env.UNSPLASH_ACCESS_KEY || '',
  // true: la foto del detalle de la receta sale de Unsplash (si falla, de TheMealDB). Las tarjetas usan TheMealDB.
  preferUnsplash: process.env.PREFER_UNSPLASH === 'true',
  translate: {
    enabled: process.env.TRANSLATE !== 'false',
    deeplKey: process.env.DEEPL_API_KEY || '',
    myMemoryEmail: process.env.MYMEMORY_EMAIL || '',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'smart_pocket_chef',
  },
};
