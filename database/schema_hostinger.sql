-- Smart Pocket Chef: esquema para Hostinger (phpMyAdmin).
-- En el hosting la base ya existe y el usuario no puede crear otras: este archivo NO tiene CREATE DATABASE ni USE.
-- Importalo dentro de la base que creaste en hPanel > Bases de datos. El servidor tambien crea estas tablas solo
-- al arrancar, asi que este archivo es un respaldo por si prefieres hacerlo a mano.

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
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
