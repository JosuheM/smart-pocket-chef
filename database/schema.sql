-- Smart Pocket Chef: esquema MySQL / MariaDB (XAMPP + phpMyAdmin)
-- El servidor también crea todo esto automáticamente al arrancar.
CREATE DATABASE IF NOT EXISTS smart_pocket_chef
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_pocket_chef;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
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
