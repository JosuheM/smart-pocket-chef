-- Smart Pocket Chef: esquema para Hostinger (phpMyAdmin).
-- En el hosting la base ya existe y el usuario no puede crear otras: este archivo NO tiene CREATE DATABASE ni USE.
-- Importalo dentro de la base que creaste en hPanel > Bases de datos. El servidor tambien crea estas tablas solo
-- al arrancar (y migra bases antiguas), asi que este archivo es un respaldo por si prefieres hacerlo a mano.

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  google_id     VARCHAR(40)  NULL UNIQUE,
  password_hash VARCHAR(100) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shopping_lists (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  recipe_id   VARCHAR(20)  NULL,
  recipe_name VARCHAR(160) NULL,
  items       TEXT         NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS translations (
  hash       CHAR(40)    PRIMARY KEY,
  direction  CHAR(5)     NOT NULL,
  src        TEXT        NOT NULL,
  dst        TEXT        NOT NULL,
  provider   VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Mi despensa
CREATE TABLE IF NOT EXISTS user_pantry (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT         NOT NULL,
  ingredient VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_ingredient (user_id, ingredient),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Notas, calificaciones y "ya la cocine"
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
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Recetas propias (comida peruana): el servidor las siembra solo al arrancar si la tabla esta vacia
CREATE TABLE IF NOT EXISTS custom_recipes (
  id          VARCHAR(20)  PRIMARY KEY,
  name        VARCHAR(160) NOT NULL,
  name_en     VARCHAR(160) NOT NULL,
  category    VARCHAR(80)  NOT NULL,
  area        VARCHAR(80)  NOT NULL DEFAULT 'Peruvian',
  photo_query VARCHAR(160) NULL,
  picture     TEXT         NULL,
  ingredients LONGTEXT     NOT NULL,
  steps       LONGTEXT     NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Base de una version anterior: ejecuta solo estas dos lineas (el servidor tambien lo hace al arrancar)
--   ALTER TABLE users ADD COLUMN google_id VARCHAR(40) NULL UNIQUE AFTER email;
--   ALTER TABLE users MODIFY password_hash VARCHAR(100) NULL;
