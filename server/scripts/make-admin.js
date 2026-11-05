// Convierte a un usuario existente en administrador (o le quita el rol).
//   npm run make-admin -- correo@ejemplo.com
//   npm run make-admin -- correo@ejemplo.com --remove
// La persona debe haberse registrado antes (con correo o con Google). Es lo mismo que ejecutar en phpMyAdmin:
//   UPDATE users SET role = 'admin' WHERE email = 'correo@ejemplo.com';
import { getPool, initDb, isDbReady } from '../src/db.js';

const email = process.argv.slice(2).find((a) => !a.startsWith('--'))?.trim().toLowerCase();
const remove = process.argv.includes('--remove');

if (!email) {
  console.error('Uso: npm run make-admin -- correo@ejemplo.com [--remove]');
  process.exit(1);
}

await initDb();
if (!isDbReady()) {
  console.error('No hay conexión con MySQL: revisa DB_HOST, DB_USER, DB_PASSWORD y DB_NAME en el archivo .env.');
  process.exit(1);
}

const pool = getPool();
const [rows] = await pool.execute('SELECT id, name, role FROM users WHERE email = ?', [email]);
if (!rows[0]) {
  console.error(`No existe ningún usuario con el correo ${email}. Primero debe registrarse en la aplicación.`);
  process.exit(1);
}

const role = remove ? 'user' : 'admin';
if (remove) {
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
  if (rows[0].role === 'admin' && n <= 1) {
    console.error('No se puede: es el único administrador. Primero convierte a otra persona.');
    process.exit(1);
  }
}
await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, rows[0].id]);
console.log(`${rows[0].name} (${email}) ahora tiene el rol "${role}".`);
process.exit(0);
