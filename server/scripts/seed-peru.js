// Siembra (seed) de las recetas peruanas en la tabla custom_recipes de MySQL.
//   npm run seed             agrega las que falten
//   npm run seed -- --force  también actualiza las que ya están con lo que dice src/data/peru.js
// El servidor hace lo mismo solo al arrancar si la tabla está vacía; este script sirve para forzarlo a mano.
import { getPool, initDb, isDbReady } from '../src/db.js';
import { PERU } from '../src/data/peru.js';
import { seedPeruvian } from '../src/services/customRecipes.js';

const force = process.argv.includes('--force');

await initDb();
if (!isDbReady()) {
  console.error('No hay conexión con MySQL: revisa DB_HOST, DB_USER, DB_PASSWORD y DB_NAME en el archivo .env.');
  process.exit(1);
}

const changed = await seedPeruvian({ force });
const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM custom_recipes');
console.log(`${changed} receta(s) ${force ? 'insertadas o actualizadas' : 'nuevas'} de ${PERU.length}. La tabla custom_recipes tiene ${total} platos.`);
process.exit(0);
