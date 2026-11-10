-- Smart Pocket Chef: esquema MySQL / MariaDB (XAMPP + phpMyAdmin)
-- El servidor también crea todo esto (y migra bases antiguas) automáticamente al arrancar.
CREATE DATABASE IF NOT EXISTS smart_pocket_chef
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_pocket_chef;

-- Usuarios: con contraseña (password_hash) o con Google (google_id, sin contraseña)
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  google_id     VARCHAR(40)  NULL UNIQUE,
  password_hash VARCHAR(100) NULL,
  role          ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favorites (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  meal_id    VARCHAR(20)  NOT NULL,
  name       VARCHAR(160) NOT NULL,
  image      VARCHAR(500) NULL,
  category   VARCHAR(80)  NULL,
  area       VARCHAR(80)  NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_meal (user_id, meal_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  recipe_id   VARCHAR(20)  NULL,
  recipe_name VARCHAR(160) NULL,
  items       TEXT         NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Caché de traducciones (cada texto se traduce una sola vez)
CREATE TABLE IF NOT EXISTS translations (
  hash       CHAR(40)    PRIMARY KEY,
  direction  CHAR(5)     NOT NULL,
  src        TEXT        NOT NULL,
  dst        TEXT        NOT NULL,
  provider   VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mi despensa: ingredientes que la persona tiene en casa
CREATE TABLE IF NOT EXISTS user_pantry (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT         NOT NULL,
  ingredient VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_ingredient (user_id, ingredient),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Nota personal, calificación (1 a 5 estrellas) y "ya la cociné" por receta
CREATE TABLE IF NOT EXISTS recipe_notes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  meal_id    VARCHAR(20)  NOT NULL,
  name       VARCHAR(160) NULL,
  image      VARCHAR(500) NULL,
  note       TEXT         NULL,
  rating     TINYINT      NULL,
  cooked     TINYINT(1)   NOT NULL DEFAULT 0,
  cooked_at  TIMESTAMP    NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_recipe (user_id, meal_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Recuperar contraseña: solo se guarda el hash (SHA-256) del enlace enviado por correo; vence en 1 hora y sirve una vez
CREATE TABLE IF NOT EXISTS password_resets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT      NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Recetas que cada persona crea para sí misma (solo su dueña o dueño las ve)
CREATE TABLE IF NOT EXISTS user_recipes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  name        VARCHAR(160) NOT NULL,
  category    VARCHAR(80)  NOT NULL,
  ingredients LONGTEXT     NOT NULL,   -- JSON: [{ "name": "chicken", "es": "Pollo", "measure": "1 presa" }]
  steps       LONGTEXT     NOT NULL,   -- JSON: ["Paso 1…", "Paso 2…"]
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user_recipes_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Recetas propias (comida peruana). El servidor las siembra solo al arrancar; también: npm run seed
CREATE TABLE IF NOT EXISTS custom_recipes (
  id          VARCHAR(20)  PRIMARY KEY,
  name        VARCHAR(160) NOT NULL,
  name_en     VARCHAR(160) NOT NULL,
  category    VARCHAR(80)  NOT NULL,
  area        VARCHAR(80)  NOT NULL DEFAULT 'Peruvian',
  photo_query VARCHAR(160) NULL,
  picture     TEXT         NULL,           -- JSON: foto fija y su crédito
  ingredients LONGTEXT     NOT NULL,       -- JSON: [{ "name": "beef sirloin", "es": "Lomo de res", "measure": "500 g" }]
  steps       LONGTEXT     NOT NULL,       -- JSON: ["Paso 1…", "Paso 2…"]
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ¿Ya tenías la base de una versión anterior? Ejecuta solo estas líneas (el servidor también lo hace al arrancar):
--   ALTER TABLE users ADD COLUMN google_id VARCHAR(40) NULL UNIQUE AFTER email;
--   ALTER TABLE users MODIFY password_hash VARCHAR(100) NULL;
--   ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER password_hash;

-- PRIMER ADMINISTRADOR (Panel de administración): la persona debe haberse registrado antes. Cambia el correo y ejecuta:
--   UPDATE users SET role = 'admin' WHERE email = 'correo@ejemplo.com';
-- Para quitarle el rol:  UPDATE users SET role = 'user' WHERE email = 'correo@ejemplo.com';
-- También se puede con el servidor:  cd server && npm run make-admin -- correo@ejemplo.com
