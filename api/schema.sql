-- Одна строка на заведение. data — то же самое JSON-меню,
-- что лежит файлом в <клиент>/data/menu.json.
CREATE TABLE IF NOT EXISTS clients (
  slug    TEXT PRIMARY KEY,
  data    TEXT    NOT NULL,
  pass    TEXT    NOT NULL,   -- pbkdf2$итерации$соль$хэш
  updated INTEGER NOT NULL
);
