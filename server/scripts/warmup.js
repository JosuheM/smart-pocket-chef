// Plan B sin internet: traduce de antemano los nombres de todas las recetas y los guarda en MySQL.
// Uso (con internet, MySQL encendido y antes de exponer):  npm run warmup
// Gasta unos 20,000 caracteres de MyMemory (el límite diario es 50,000 con MYMEMORY_EMAIL, 5,000 sin él).
import { initDb, isDbReady } from '../src/db.js';
import { catalogNames, ensureCatalog, initCatalog } from '../src/services/catalog.js';
import { provider, translateMany } from '../src/services/translate.js';

await initDb();
if (!isDbReady()) {
  console.error('MySQL no está encendido: sin él las traducciones no se guardan. Enciéndelo en XAMPP y vuelve a intentar.');
  process.exit(1);
}
if (!provider) {
  console.log('La traducción está desactivada (TRANSLATE=false). No hay nada que precargar.');
  process.exit(0);
}

await initCatalog();
await ensureCatalog();
const names = catalogNames();
if (!names.length) {
  console.error('El catálogo está vacío: conéctate a internet para descargarlo primero.');
  process.exit(1);
}

console.log(`Traduciendo ${names.length} nombres de recetas con ${provider}…`);
const BATCH = 24;
let translated = 0;
let stalled = 0;
for (let i = 0; i < names.length; i += BATCH) {
  const part = names.slice(i, i + BATCH);
  const out = await translateMany(part);
  const changed = out.filter((t, k) => t !== part[k]).length;
  translated += changed;
  stalled = changed === 0 ? stalled + 1 : 0;
  console.log(`${Math.min(i + BATCH, names.length)}/${names.length} (${translated} traducidos)`);
  if (stalled >= 2) {
    console.error('El servicio de traducción no responde o se agotó la cuota diaria. Vuelve a ejecutarlo más tarde: lo ya traducido queda guardado.');
    break;
  }
}
console.log('Listo.');
process.exit(0);
