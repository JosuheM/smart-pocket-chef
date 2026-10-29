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
    password_hash VARCHAR(100) NOT NULL,
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
];

/**
 * Conecta con la base y crea las tablas que falten. Si MySQL no responde, el buscador sigue funcionando sin cuentas.
 * Primero se conecta directo a la base (como en un hosting, donde ya existe y el usuario no puede crear otras);
 * solo si no existe (XAMPP la primera vez) intenta crearla.
 */
export async function initDb() {
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
    pool = p;
    console.log(`MySQL conectado (base "${name}").`);
  } catch (err) {
    console.warn(`No se pudo conectar a MySQL: ${err.code ? `${err.code} ` : ''}${err.message}`);
    console.warn('El buscador funciona, pero cuentas, favoritos e historial estarán desactivados.');
  }
}
