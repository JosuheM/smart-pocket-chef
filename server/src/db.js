import mysql from 'mysql2/promise';
import { config } from './config.js';
import { HttpError } from './utils/http.js';

let pool = null;

export const isDbReady = () => pool !== null;

export function getPool() {
  if (!pool) throw new HttpError(503, 'La base de datos no está disponible.');
  return pool;
}

const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    google_id VARCHAR(40) NULL UNIQUE,
    password_hash VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    meal_id VARCHAR(20) NOT NULL,
    name VARCHAR(160) NOT NULL,
    image VARCHAR(500) NULL,
    category VARCHAR(80) NULL,
    area VARCHAR(80) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_meal (user_id, meal_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS shopping_lists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    recipe_id VARCHAR(20) NULL,
    recipe_name VARCHAR(160) NULL,
    items TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  // Caché persistente de traducciones: cada texto se traduce una sola vez, aunque el servidor se reinicie.
  `CREATE TABLE IF NOT EXISTS translations (
    hash CHAR(40) PRIMARY KEY,
    direction CHAR(5) NOT NULL,
    src TEXT NOT NULL,
    dst TEXT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  // Mi despensa: los ingredientes que la persona tiene en casa
  `CREATE TABLE IF NOT EXISTS user_pantry (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ingredient VARCHAR(80) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_ingredient (user_id, ingredient),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  // Nota personal, calificación (1 a 5) y "ya la cociné" de cada receta
  `CREATE TABLE IF NOT EXISTS recipe_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    meal_id VARCHAR(20) NOT NULL,
    name VARCHAR(160) NULL,
    image VARCHAR(500) NULL,
    note TEXT NULL,
    rating TINYINT NULL,
    cooked TINYINT(1) NOT NULL DEFAULT 0,
    cooked_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_recipe (user_id, meal_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  // Recetas propias (comida peruana): el buscador las suma a las de TheMealDB
  `CREATE TABLE IF NOT EXISTS custom_recipes (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    name_en VARCHAR(160) NOT NULL,
    category VARCHAR(80) NOT NULL,
    area VARCHAR(80) NOT NULL DEFAULT 'Peruvian',
    photo_query VARCHAR(160) NULL,
    picture TEXT NULL,
    ingredients LONGTEXT NOT NULL,
    steps LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
];

/** Bases creadas con una versión anterior: agrega el acceso con Google a la tabla de usuarios. */
async function migrate(p) {
  const [cols] = await p.query("SHOW COLUMNS FROM users LIKE 'google_id'");
  if (!cols.length) await p.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(40) NULL UNIQUE AFTER email');
  await p.query('ALTER TABLE users MODIFY password_hash VARCHAR(100) NULL'); // las cuentas de Google no tienen contraseña
}

// Tareas que necesitan la base lista (por ejemplo, cargar las recetas propias); también corren si la base conecta más tarde
const readyHooks = [];
export const onDbReady = (fn) => { readyHooks.push(fn); };

/**
 * Conecta con la base y crea las tablas que falten. Si MySQL no responde, el buscador sigue funcionando sin cuentas.
 * Primero se conecta directo a la base (como en un hosting, donde ya existe y el usuario no puede crear otras);
 * solo si no existe (XAMPP la primera vez) intenta crearla.
 */
export async function initDb({ quiet = false } = {}) {
  const { host, port, user, password, name } = config.db;
  const poolConfig = {
    host, port, user, password, database: name,
    waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4', connectTimeout: 10000,
  };
  try {
    if (!/^\w+$/.test(name)) throw new Error('DB_NAME solo puede tener letras, números y guion bajo');

    let p = mysql.createPool(poolConfig);
    try {
      await p.query('SELECT 1');
    } catch (err) {
      await p.end().catch(() => {});
      if (err.code !== 'ER_BAD_DB_ERROR') throw err;
      const boot = await mysql.createConnection({ host, port, user, password });
      await boot.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await boot.end();
      p = mysql.createPool(poolConfig);
      await p.query('SELECT 1');
    }

    for (const sql of TABLES) await p.query(sql);
    await migrate(p);
    pool = p;
    console.log(`MySQL conectado (base "${name}").`);
    for (const hook of readyHooks) {
      Promise.resolve().then(hook).catch((err) => console.warn(`Tarea posterior a la conexión con MySQL: ${err.message}`));
    }
  } catch (err) {
    if (quiet) return;
    console.warn(`No se pudo conectar a MySQL: ${err.code ? `${err.code} ` : ''}${err.message}`);
    console.warn('El buscador funciona, pero cuentas, favoritos e historial estarán desactivados.');
  }
}

/**
 * Si MySQL no estaba listo al arrancar (contraseña por corregir, base que tarda), reintenta cada minuto en silencio
 * hasta conectar: así no hace falta reiniciar la app cuando se arregla el problema.
 */
export function keepTryingDb(intervalMs = Number(process.env.DB_RETRY_MS) || 60_000) {
  if (pool) return;
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await initDb({ quiet: true });
      if (pool) clearInterval(timer);
    } finally {
      busy = false;
    }
  }, intervalMs);
  timer.unref();
}
